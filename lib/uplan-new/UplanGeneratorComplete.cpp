#include "UplanGeneratorComplete.h"
#include <fstream>
#include <sstream>
#include <cmath>
#include <limits>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <GeographicLib/Geodesic.hpp>
#include "Functions.h"

namespace UPlanGeneration {

using namespace GeographicLib;

UplanGeneratorComplete::UplanGeneratorComplete() : config() {}

UplanGeneratorComplete::UplanGeneratorComplete(const UplanConfigComplete& config) : config(config) {}

std::vector<WaypointComplete> UplanGeneratorComplete::loadWaypointsFromCSV(const std::string& csv_path) {
    std::vector<WaypointComplete> waypoints;
    std::ifstream file(csv_path);
    
    if (!file.is_open()) {
        std::cerr << "[ERROR] Cannot open trajectory file: " << csv_path << std::endl;
        return waypoints;
    }

    std::string line;
    bool headerSkipped = false;

    while (std::getline(file, line)) {
        // Skip empty lines
        if (line.empty()) continue;
        
        // Skip comment lines
        if (line.size() >= 2 && line[0] == '/' && line[1] == '/') continue;
        
        // Skip header line
        if (!headerSkipped) {
            if (line.find("SimTime") != std::string::npos || 
                line.find("Lat") != std::string::npos) {
                headerSkipped = true;
                continue;
            }
        }
        
        std::istringstream iss(line);
        std::string token;
        WaypointComplete wp;

        try {
            // CSV format: SimTime,Lat,Lon,Alt,qw,qx,qy,qz,Vx,Vy,Vz
            if (!std::getline(iss, token, ',')) continue;
            wp.time = std::stod(token);  // SimTime
            
            if (!std::getline(iss, token, ',')) continue;
            wp.lat = std::stod(token);   // Lat
            
            if (!std::getline(iss, token, ',')) continue;
            wp.lon = std::stod(token);   // Lon
            
            if (!std::getline(iss, token, ',')) continue;
            wp.h = std::stod(token);     // Alt (AGL)
            
            // Remaining fields (qw,qx,qy,qz,Vx,Vy,Vz) are ignored
            
            waypoints.push_back(wp);
        }
        catch (const std::exception& e) {
            std::cerr << "[WARNING] Failed to parse line: " << line << " - " << e.what() << std::endl;
            continue;
        }
    }

    if (!waypoints.empty()) {
        std::cout << "[INFO] Loaded " << waypoints.size() << " waypoints from: " << csv_path << std::endl;
        std::cout << "[INFO] First waypoint: lat=" << waypoints.front().lat 
                  << ", lon=" << waypoints.front().lon 
                  << ", alt=" << waypoints.front().h 
                  << ", time=" << waypoints.front().time << std::endl;
        std::cout << "[INFO] Last waypoint: lat=" << waypoints.back().lat 
                  << ", lon=" << waypoints.back().lon 
                  << ", alt=" << waypoints.back().h 
                  << ", time=" << waypoints.back().time << std::endl;
    }

    return waypoints;
}

std::vector<WaypointComplete> UplanGeneratorComplete::reduceWaypoints(
    const std::vector<WaypointComplete>& waypoints, int compression_factor) {
    
    if (waypoints.size() <= 2) return waypoints;
    if (compression_factor < 1) compression_factor = 1;

    std::vector<WaypointComplete> reduced;
    
    // Equivalente a MATLAB: wp_reduced = wp(2:compression_factor:end, :)
    // Empezamos desde índice 1 (segundo punto) y tomamos cada compression_factor puntos
    for (size_t i = 1; i < waypoints.size(); i += compression_factor) {
        reduced.push_back(waypoints[i]);
    }
    
    // Asegurar que el último punto siempre esté incluido
    if (!reduced.empty() && reduced.back().time != waypoints.back().time) {
        reduced.push_back(waypoints.back());
    }
    
    std::cout << "[INFO] Reduced waypoints from " << waypoints.size() 
              << " to " << reduced.size() 
              << " (compression_factor=" << compression_factor << ")" << std::endl;
    
    return reduced;
}

double UplanGeneratorComplete::calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const Geodesic& geod = Geodesic::WGS84();
    double s12;
    geod.Inverse(lat1, lon1, lat2, lon2, s12);
    return s12;
}

double UplanGeneratorComplete::calculateAzimuth(double lat1, double lon1, double lat2, double lon2) {
    const Geodesic& geod = Geodesic::WGS84();
    double s12, azi1, azi2;
    geod.Inverse(lat1, lon1, lat2, lon2, s12, azi1, azi2);
    return azi1;
}

std::vector<Point> UplanGeneratorComplete::generateOrientedRectangleCorners(
    double mid_lat, double mid_lon, double azimuth, double along_track, double cross_track) {
    
    const Geodesic& geod = Geodesic::WGS84();
    std::vector<Point> corners;

    double perpendicular_left = azimuth - 90.0;
    double perpendicular_right = azimuth + 90.0;

    double front_lat, front_lon, back_lat, back_lon;
    geod.Direct(mid_lat, mid_lon, azimuth, along_track, front_lat, front_lon);
    geod.Direct(mid_lat, mid_lon, azimuth + 180.0, along_track, back_lat, back_lon);

    double corner1_lat, corner1_lon, corner2_lat, corner2_lon;
    double corner3_lat, corner3_lon, corner4_lat, corner4_lon;

    geod.Direct(front_lat, front_lon, perpendicular_left, cross_track, corner1_lat, corner1_lon);
    geod.Direct(front_lat, front_lon, perpendicular_right, cross_track, corner2_lat, corner2_lon);
    geod.Direct(back_lat, back_lon, perpendicular_right, cross_track, corner3_lat, corner3_lon);
    geod.Direct(back_lat, back_lon, perpendicular_left, cross_track, corner4_lat, corner4_lon);

    corners.push_back(Point(corner1_lon, corner1_lat));
    corners.push_back(Point(corner2_lon, corner2_lat));
    corners.push_back(Point(corner3_lon, corner3_lat));
    corners.push_back(Point(corner4_lon, corner4_lat));
    corners.push_back(Point(corner1_lon, corner1_lat)); // Close polygon

    return corners;
}

std::vector<Volume> UplanGeneratorComplete::generateVolumes(
    const std::vector<WaypointComplete>& wp_reduced, double start_timestamp) {
    
    std::vector<Volume> volumes;
    volumes.reserve(wp_reduced.size() - 1);

    const double minimum_ground_clearance = 10.0;  // Minimum buffer above ground (meters)

    for (size_t i = 0; i < wp_reduced.size() - 1; ++i) {
        const WaypointComplete& wp1 = wp_reduced[i];
        const WaypointComplete& wp2 = wp_reduced[i + 1];

        double distance = calculateDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
        double azimuth = calculateAzimuth(wp1.lat, wp1.lon, wp2.lat, wp2.lon);

        double mid_lat = (wp1.lat + wp2.lat) / 2.0;
        double mid_lon = (wp1.lon + wp2.lon) / 2.0;
        
        // For altitude, use min and max to cover the entire segment
        double min_alt = std::min(wp1.h, wp2.h);
        double max_alt = std::max(wp1.h, wp2.h);
        double mid_alt = (min_alt + max_alt) / 2.0;

        double horizontal_distance = distance;
        double vertical_distance = std::abs(wp2.h - wp1.h);

        bool is_horizontal = horizontal_distance > config.Alpha_H * vertical_distance;
        bool is_vertical = vertical_distance > config.Alpha_V * horizontal_distance;

        double along_track, cross_track, vertical_buffer;
        
        if (is_horizontal) {
            // Horizontal segment: extend along track, standard cross track
            along_track = distance / 2.0 + config.TSE_H;
            cross_track = config.TSE_H;
            vertical_buffer = config.TSE_V;
        } else if (is_vertical) {
            // Vertical segment (takeoff/landing): minimal horizontal extent
            along_track = config.TSE_H;
            cross_track = config.TSE_H;
            vertical_buffer = vertical_distance / 2.0 + config.TSE_V;
        } else {
            // Mixed segment: cover both
            along_track = distance / 2.0 + config.TSE_H;
            cross_track = config.TSE_H;
            vertical_buffer = vertical_distance / 2.0 + config.TSE_V;
        }

        std::vector<Point> corners = generateOrientedRectangleCorners(
            mid_lat, mid_lon, azimuth, along_track, cross_track);

        // Calculate bounding box
        double minLon = std::numeric_limits<double>::max();
        double maxLon = std::numeric_limits<double>::lowest();
        double minLat = std::numeric_limits<double>::max();
        double maxLat = std::numeric_limits<double>::lowest();

        for (size_t j = 0; j < corners.size() - 1; ++j) {
            double lon = corners[j].getLon();
            double lat = corners[j].getLat();
            minLon = std::min(minLon, lon);
            maxLon = std::max(maxLon, lon);
            minLat = std::min(minLat, lat);
            maxLat = std::max(maxLat, lat);
        }

        std::vector<double> bbox = {minLon, minLat, maxLon, maxLat};
        std::vector<std::vector<Point>> coordinates = {corners};
        Geometry geometry("Polygon", coordinates, bbox);

        // Calculate altitude limits
        double minAltValue = mid_alt - vertical_buffer;
        if (minAltValue < minimum_ground_clearance) {
            minAltValue = minimum_ground_clearance;
        }

        Altitude minAltitude;
        minAltitude.setValue(minAltValue);
        minAltitude.setUom("M");
        minAltitude.setReference("AGL");

        Altitude maxAltitude;
        maxAltitude.setValue(mid_alt + vertical_buffer);
        maxAltitude.setUom("M");
        maxAltitude.setReference("AGL");

        // Calculate time window
        double segment_start_time = start_timestamp + wp1.time;
        double segment_end_time = start_timestamp + wp2.time;

        long long timeBeginSeconds = static_cast<long long>(segment_start_time - config.tbuf);
        long long timeEndSeconds = static_cast<long long>(segment_end_time + config.tbuf);

        auto timeBegin = Functions::from_unix_timestamp(timeBeginSeconds);
        auto timeEnd = Functions::from_unix_timestamp(timeEndSeconds);

        Volume volume(geometry, timeBegin, timeEnd, minAltitude, maxAltitude, static_cast<int>(i));
        volumes.push_back(volume);
    }

    std::cout << "[INFO] Generated " << volumes.size() << " volumes" << std::endl;
    return volumes;
}

nlohmann::json UplanGeneratorComplete::generateDefaultDataIdentifier(
    const std::string& sac, const std::string& sic) {
    return {
        {"sac", sac},
        {"sic", sic}
    };
}

nlohmann::json UplanGeneratorComplete::generateDefaultContactDetails() {
    return {
        {"firstName", "TBD"},
        {"lastName", "TBD"},
        {"phones", nlohmann::json::array({"TBD"})},
        {"emails", nlohmann::json::array({"tbd@example.com"})}
    };
}

nlohmann::json UplanGeneratorComplete::generateDefaultFlightDetails(const std::string& category) {
    std::string mode = "VLOS";
    if (category.find("SAIL") != std::string::npos) {
        mode = "BVLOS";
    }

    return {
        {"mode", mode},
        {"category", category},
        {"specialOperation", ""},
        {"privateFlight", false}
    };
}

nlohmann::json UplanGeneratorComplete::generateDefaultUAS(
    const std::string& uasType, double mtom, double vMax) {
    return {
        {"registrationNumber", "TBD"},
        {"serialNumber", "TBD"},
        {"flightCharacteristics", {
            {"uasMTOM", mtom},
            {"uasMaxSpeed", vMax},
            {"Connectivity", "LTE"},
            {"idTechnology", "NRID"},
            {"maxFlightTime", 0}
        }},
        {"generalCharacteristics", {
            {"brand", "TBD"},
            {"model", "TBD"},
            {"typeCertificate", "TBD"},
            {"uasType", uasType},
            {"uasClass", "NONE"},
            {"uasDimension", "LT_1"}
        }}
    };
}

nlohmann::json UplanGeneratorComplete::generateDefaultLocation(double lat, double lon, double alt) {
    return {
        {"type", "Point"},
        {"coordinates", nlohmann::json::array({lon, lat})},
        {"reference", "AGL"},
        {"altitude", alt}
    };
}

nlohmann::json UplanGeneratorComplete::generateTBDLocation() {
    return {
        {"type", "Point"},
        {"coordinates", nlohmann::json::array({0.0, 0.0})},
        {"reference", "AGL"},
        {"altitude", 0.0}
    };
}

nlohmann::json UplanGeneratorComplete::generateCompleteUplan(
    int uplan_id,
    const std::string& uplan_name,
    const std::string& trajectory_csv_path,
    double start_timestamp,
    const std::string& category,
    const std::string& uasType,
    double mtom,
    double vMax) {

    // Load and reduce waypoints
    auto waypoints = loadWaypointsFromCSV(trajectory_csv_path);
    if (waypoints.empty()) {
        std::cerr << "[ERROR] No waypoints loaded from: " << trajectory_csv_path << std::endl;
        return {};
    }

    auto wp_reduced = reduceWaypoints(waypoints,20);
    if (wp_reduced.size() < 2) {
        std::cerr << "[ERROR] Not enough waypoints after reduction" << std::endl;
        return {};
    }

    auto volumes = generateVolumes(wp_reduced, start_timestamp);

    // Get takeoff and landing positions
    const auto& takeoff = waypoints.front();
    const auto& landing = waypoints.back();

    // Generate ISO 8601 timestamp
    std::string iso_time = Functions::now_iso_string() + "Z";

    // Build volumes JSON array
    nlohmann::json volumesJson = nlohmann::json::array();
    for (const auto& vol : volumes) {
        volumesJson.push_back(vol.toJson());
    }

    // Build complete Uplan according to schema
    nlohmann::json uplanJson = {
        {"idplan", uplan_id},
        {"nameplan", uplan_name},
        {"dataOwnerIdentifier", generateDefaultDataIdentifier("TBD", "TBD")},
        {"dataSourceIdentifier", generateDefaultDataIdentifier("TBD", "TBD")},
        {"contactDetails", generateDefaultContactDetails()},
        {"flightDetails", generateDefaultFlightDetails(category)},
        {"uas", generateDefaultUAS(uasType, mtom, vMax)},
        {"takeoffLocation", generateDefaultLocation(takeoff.lat, takeoff.lon, takeoff.h)},
        {"landingLocation", generateDefaultLocation(landing.lat, landing.lon, landing.h)},
        {"gcsLocation", generateTBDLocation()},
        {"operationVolumes", volumesJson},
        {"operatorId", "TBD"},
        {"state", "SENT"},
        {"creationTime", iso_time},
        {"updateTime", iso_time}
    };

    return uplanJson;
}

} // namespace UPlanGeneration