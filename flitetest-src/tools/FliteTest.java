import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.document.OpenRocketDocument;
import info.openrocket.core.document.Simulation;
import info.openrocket.core.simulation.*;
import info.openrocket.core.models.wind.WindModelType;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.aerodynamics.*;
import info.openrocket.core.masscalc.MassCalculator;
import info.openrocket.core.motor.MotorConfiguration;
import info.openrocket.core.logging.WarningSet;
import java.io.*;
import java.util.*;

/**
 * flitetest sweep engine.
 * Usage: FliteTest rocket.ork outDir (railLength_m | static) [lat lon alt_m]
 * Writes summary.csv, trajectories.csv and meta.json (stability, mass, parts, motor).
 * Sweep: wind 0..20 kt in 0.5 kt steps from 225/270/315 deg, 10% turbulence.
 */
public class FliteTest {
    static String esc(String s) { return s.replace("\\", "\\\\").replace("\"", "\\\"").replaceAll("\\s", " "); }
    static String num(double v) { return Double.isNaN(v) || Double.isInfinite(v) ? "null" : String.format(Locale.US, "%.2f", v); }

    public static void main(String[] a) throws Exception {
        String ork = a[0], outDir = a[1];
        boolean staticOnly = a[2].equals("static"); // geometry/mass/stability only, no sweep (used to draw older versions)
        double rail = staticOnly ? 1.83 : Double.parseDouble(a[2]);
        double lat = a.length > 3 ? Double.parseDouble(a[3]) : 41.2381;
        double lon = a.length > 4 ? Double.parseDouble(a[4]) : -81.8418;
        double alt = a.length > 5 ? Double.parseDouble(a[5]) : 350;

        OpenRocketCore.initialize(new info.openrocket.core.plugin.PluginModule(), new com.google.inject.AbstractModule() {
            protected void configure() {
                bind(info.openrocket.core.database.ComponentPresetDao.class).to(info.openrocket.core.database.ComponentPresetDatabase.class);
            }
        });
        Thread.sleep(300);
        GeneralRocketLoader loader = new GeneralRocketLoader(new File(ork));
        OpenRocketDocument doc = loader.load();
        Rocket rocket = doc.getRocket();
        if (doc.getSimulations().isEmpty()) {
            Simulation s = new Simulation(doc, rocket);
            doc.addSimulation(s);
        }
        Simulation base = doc.getSimulations().get(0);

        // ---- static stability / mass (design-screen values) ----
        FlightConfiguration fc = rocket.getFlightConfiguration(base.getFlightConfigurationId());
        if (fc == null) fc = rocket.getSelectedConfiguration();
        FlightConditions cond = new FlightConditions(fc); cond.setMach(0.3); cond.setAOA(0); cond.setTheta(0);
        WarningSet ws = new WarningSet();
        double cpx = new BarrowmanCalculator().getCP(fc, cond, ws).x;
        var cg = MassCalculator.calculateLaunch(fc).getCM();
        double ref = cond.getRefLength();
        StringBuilder meta = new StringBuilder();
        meta.append("{");
        meta.append(String.format(Locale.US, "\"name\":\"%s\",\"mass_g\":%.2f,\"length_mm\":%.1f,\"cg_mm\":%.1f,\"cp_mm\":%.1f,\"ref_mm\":%.2f,\"stab_cal\":%.3f,",
                esc(rocket.getName()), cg.weight * 1000, rocket.getLength() * 1000, cg.x * 1000, cpx * 1000, ref * 1000, (cpx - cg.x) / ref));
        String motor = "none"; double motorMass = 0, impulse = 0;
        for (MotorConfiguration mc : fc.getActiveMotors()) {
            motor = mc.getMotor().getDesignation() + (mc.getEjectionDelay() > 0 ? String.format(Locale.US, "-%.0f", mc.getEjectionDelay()) : "");
            motorMass = mc.getMotor().getLaunchMass() * 1000; impulse = mc.getMotor().getTotalImpulseEstimate();
            try { motor = ((info.openrocket.core.motor.ThrustCurveMotor) mc.getMotor()).getManufacturer().getDisplayName() + " " + motor; } catch (Exception e) {}
        }
        meta.append(String.format(Locale.US, "\"motor\":\"%s\",\"motor_mass_g\":%.1f,\"impulse_ns\":%.1f,", esc(motor), motorMass, impulse));
        meta.append("\"parts\":[");
        boolean first = true;
        for (RocketComponent c : rocket) {
            if (c instanceof Rocket || c instanceof AxialStage) continue;
            if (!first) meta.append(",");
            first = false;
            meta.append(String.format(Locale.US, "[\"%s\",%.1f,%.1f,%.1f]", esc(c.getName()), c.getComponentMass() * 1000, c.getComponentLocations()[0].x * 1000, c.getLength() * 1000));
        }
        if (motorMass > 0) meta.append(String.format(Locale.US, "%s[\"MOTOR %s\",%.1f,null,null]", first ? "" : ",", esc(motor), motorMass));
        // component detail for rule checks: [type, name, mass_g, x_mm, len_mm, od_mm, id_mm]
        meta.append("],\"comps\":[");
        first = true;
        for (RocketComponent c : rocket) {
            if (c instanceof Rocket || c instanceof AxialStage) continue;
            double od = Double.NaN, id = Double.NaN;
            if (c instanceof BodyTube) { od = ((BodyTube) c).getOuterRadius() * 2; id = ((BodyTube) c).getInnerRadius() * 2; }
            else if (c instanceof InnerTube) { od = ((InnerTube) c).getOuterRadius() * 2; id = ((InnerTube) c).getInnerRadius() * 2; }
            else if (c instanceof LaunchLug) { od = ((LaunchLug) c).getOuterRadius() * 2; id = ((LaunchLug) c).getInnerRadius() * 2; }
            else if (c instanceof RailButton) { od = ((RailButton) c).getOuterDiameter(); id = ((RailButton) c).getInnerDiameter(); }
            else if (c instanceof Parachute) { od = ((Parachute) c).getDiameter(); }
            else if (c instanceof NoseCone) { od = ((NoseCone) c).getAftRadius() * 2; }
            else if (c instanceof Transition) { od = ((Transition) c).getForeRadius() * 2; id = ((Transition) c).getAftRadius() * 2; }
            else if (c instanceof RingComponent) { od = ((RingComponent) c).getOuterRadius() * 2; id = ((RingComponent) c).getInnerRadius() * 2; }
            // geometry for the auto-generated drawing (mm)
            StringBuilder g = new StringBuilder("{");
            g.append(String.format(Locale.US, "\"qty\":%d", c.getInstanceCount()));
            try {
                Object m = c.getClass().getMethod("getMaterial").invoke(c);
                if (m != null) g.append(",\"mat\":\"").append(esc(((info.openrocket.core.material.Material) m).getName())).append("\"");
            } catch (Exception e) { }
            if (c instanceof Transition) { // includes NoseCone: radius profile, 25 samples from fore to aft
                Transition tr = (Transition) c;
                g.append(",\"shape\":\"").append(tr.getShapeType().name()).append("\",\"prof\":[");
                for (int i = 0; i <= 24; i++) g.append(i > 0 ? "," : "").append(num(tr.getRadius(tr.getLength() * i / 24.0) * 1000));
                g.append("]");
            }
            if (c instanceof FinSet) {
                FinSet f = (FinSet) c;
                g.append(String.format(Locale.US, ",\"n\":%d,\"t\":%s,\"br\":%s,\"pts\":[", f.getFinCount(), num(f.getThickness() * 1000), num(f.getBodyRadius() * 1000)));
                var pts = f.getFinPoints();
                for (int i = 0; i < pts.length; i++) g.append(i > 0 ? "," : "").append("[").append(num(pts[i].x * 1000)).append(",").append(num(pts[i].y * 1000)).append("]");
                g.append("]");
            }
            if (c instanceof MassObject) g.append(",\"r\":").append(num(((MassObject) c).getRadius() * 1000));
            if (c instanceof InnerTube) g.append(",\"overhang\":").append(num(((InnerTube) c).getMotorOverhang() * 1000));
            g.append("}");
            if (!first) meta.append(",");
            first = false;
            meta.append(String.format(Locale.US, "[\"%s\",\"%s\",%.2f,%.1f,%.1f,%s,%s,%s]", c.getClass().getSimpleName(), esc(c.getName()),
                    c.getComponentMass() * 1000, c.getComponentLocations()[0].x * 1000, c.getLength() * 1000, num(od * 1000), num(id * 1000), g));
        }
        meta.append("]");
        for (MotorConfiguration mc : fc.getActiveMotors()) {
            RocketComponent mount = (RocketComponent) mc.getMount();
            double len = mc.getMotor().getLength();
            double aft = mount.getComponentLocations()[0].x + mount.getLength() + mc.getMount().getMotorOverhang();
            meta.append(String.format(Locale.US, ",\"motor_geo\":{\"len\":%s,\"d\":%s,\"x\":%s,\"delay\":%s}", num(len * 1000), num(mc.getMotor().getDiameter() * 1000), num((aft - len) * 1000), num(mc.getEjectionDelay())));
        }
        meta.append(",\"load_warnings\":\"").append(esc(loader.getWarnings().toString())).append("\"}");
        if (staticOnly) {
            try (PrintWriter m = new PrintWriter(new FileWriter(outDir + "/meta.json"))) { m.print(meta); }
            System.exit(0);
        }

        PrintWriter sum = new PrintWriter(new FileWriter(outDir + "/summary.csv"));
        sum.println("run,wind_kt,wind_mps,wind_from_deg,apogee_m,max_vel_mps,max_mach,time_to_apogee_s,flight_time_s,rod_exit_vel_mps,deploy_vel_mps,ground_hit_vel_mps,land_x_m,land_y_m,drift_m,apogee_x_m,apogee_y_m,min_stability_cal,stability_rod_exit_cal,max_accel_mps2");
        PrintWriter traj = new PrintWriter(new FileWriter(outDir + "/trajectories.csv"));
        traj.println("run,t,x,y,z,vz,v,stab,aoa_deg,accel");
        int run = 0;
        for (double dir : new double[]{225, 270, 315}) {
            for (double kt = 0; kt <= 20 + 1e-9; kt += 0.5) {
                run++;
                Simulation sim = base.copy();
                SimulationOptions o = sim.getOptions();
                o.setLaunchLatitude(lat); o.setLaunchLongitude(lon); o.setLaunchAltitude(alt);
                o.setLaunchRodLength(rail); o.setLaunchRodAngle(0);
                o.setWindModelType(WindModelType.AVERAGE);
                double mps = kt * 0.514444;
                o.setWindSpeedAverage(mps); o.setWindTurbulenceIntensity(0.10); o.setWindDirection(Math.toRadians(dir));
                sim.simulate();
                FlightData fd = sim.getSimulatedData();
                FlightDataBranch b = fd.getBranch(0);
                List<Double> t = b.get(FlightDataType.TYPE_TIME), x = b.get(FlightDataType.TYPE_POSITION_X), y = b.get(FlightDataType.TYPE_POSITION_Y),
                        z = b.get(FlightDataType.TYPE_ALTITUDE), st = b.get(FlightDataType.TYPE_STABILITY), vz = b.get(FlightDataType.TYPE_VELOCITY_Z),
                        vt = b.get(FlightDataType.TYPE_VELOCITY_TOTAL), aoa = b.get(FlightDataType.TYPE_AOA), acc = b.get(FlightDataType.TYPE_ACCELERATION_TOTAL);
                int n = t.size(), iAp = 0;
                for (int i = 0; i < n; i++) if (z.get(i) > z.get(iAp)) iAp = i;
                double rodT = -1;
                for (FlightEvent e : b.getEvents()) if (e.getType().name().equals("LAUNCHROD")) { rodT = e.getTime(); break; }
                double minS = Double.NaN, rodS = Double.NaN;
                for (int i = 0; i < iAp; i++) {
                    double s = st.get(i);
                    if (Double.isNaN(s) || (rodT >= 0 && t.get(i) < rodT)) continue;
                    if (Double.isNaN(rodS)) rodS = s;
                    if (Double.isNaN(minS) || s < minS) minS = s;
                }
                double lx = x.get(n - 1), ly = y.get(n - 1);
                sum.printf(Locale.US, "%d,%.1f,%.4f,%.0f,%.3f,%.3f,%.4f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.4f,%.4f,%.3f%n",
                        run, kt, mps, dir, fd.getMaxAltitude(), fd.getMaxVelocity(), fd.getMaxMachNumber(), fd.getTimeToApogee(), fd.getFlightTime(),
                        fd.getLaunchRodVelocity(), fd.getDeploymentVelocity(), fd.getGroundHitVelocity(), lx, ly, Math.hypot(lx, ly),
                        x.get(iAp), y.get(iAp), minS, rodS, fd.getMaxAcceleration());
                for (int i = 0; i < n; i++)
                    traj.printf(Locale.US, "%d,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.4f,%.3f,%.3f%n", run, t.get(i), x.get(i), y.get(i), z.get(i), vz.get(i), vt.get(i), st.get(i), Math.toDegrees(aoa.get(i)), acc.get(i));
                System.err.printf("run %d dir %.0f kt %.1f apogee %.1f m%n", run, dir, kt, fd.getMaxAltitude());
            }
        }
        sum.close(); traj.close();
        try (PrintWriter m = new PrintWriter(new FileWriter(outDir + "/meta.json"))) { m.print(meta); }
        System.exit(0);
    }
}
