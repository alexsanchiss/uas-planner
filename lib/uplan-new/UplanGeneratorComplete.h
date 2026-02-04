#ifndef UPLAN_GENERATOR_COMPLETE_H
#define UPLAN_GENERATOR_COMPLETE_H

#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include "Volume.h"
#include "Point.h"
#include "Geometry.h"
#include "Altitude.h"

namespace UPlanGeneration {

struct WaypointComplete {
    double lat;
    double lon;
    double h;
    double time;
};

struct UplanConfigComplete {
    double TSE_H = 15.0;
    double TSE_V = 10.0;
    double Alpha_H = 7.0;
    double Alpha_V = 1.0;
    double tbuf = 5.0;
};

class UplanGeneratorComplete {
public:
    UplanGeneratorComplete();
    UplanGeneratorComplete(const UplanConfigComplete& config);

    // Genera un Uplan completo a partir de un CSV de trayectoria
    nlohmann::json generateCompleteUplan(
        int uplan_id,
        const std::string& uplan_name,
        const std::string& trajectory_csv_path,
        double start_timestamp,
        const std::string& category,
        const std::string& uasType,
        double mtom,
        double vMax
    );

    // Carga waypoints desde un CSV
    std::vector<WaypointComplete> loadWaypointsFromCSV(const std::string& csv_path);

    // Reduce waypoints tomando cada N puntos (como en MATLAB: wp(2:compression_factor:end, :))
    std::vector<WaypointComplete> reduceWaypoints(const std::vector<WaypointComplete>& waypoints, int compression_factor = 20);

    // Genera los volúmenes a partir de los waypoints
    std::vector<Volume> generateVolumes(const std::vector<WaypointComplete>& waypoints, double start_timestamp);

private:
    UplanConfigComplete config;

    // Funciones auxiliares
    double calculateDistance(double lat1, double lon1, double lat2, double lon2);
    double calculateAzimuth(double lat1, double lon1, double lat2, double lon2);
    std::vector<Point> generateOrientedRectangleCorners(double mid_lat, double mid_lon, double azimuth, double along_track, double cross_track);

    // Genera datos por defecto para campos del Uplan
    nlohmann::json generateDefaultDataIdentifier(const std::string& sac, const std::string& sic);
    nlohmann::json generateDefaultContactDetails();  // Sin parámetros
    nlohmann::json generateDefaultFlightDetails(const std::string& category);
    nlohmann::json generateDefaultUAS(const std::string& uasType, double mtom, double vMax);
    nlohmann::json generateDefaultLocation(double lat, double lon, double alt);
    nlohmann::json generateTBDLocation(); 
};

} // namespace UPlanGeneration

#endif // UPLAN_GENERATOR_COMPLETE_H