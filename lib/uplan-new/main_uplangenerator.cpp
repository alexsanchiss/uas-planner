#include <iostream>
#include <fstream>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <map>
#include <algorithm>
#include "UplanGeneratorComplete.h"
#include "Uplan.h"
#include "OperationalIntent.h"
#include "Functions.h"

namespace fs = std::filesystem;
using json = nlohmann::json;

// Datos de Vmax y MTOM por categoría y tipo
struct UASData {
    double vMax;   // m/s
    double mtom;   // kg
};

// Mapa: "categoria_tipo" -> {vMax, mtom}
std::map<std::string, UASData> uasDataMap = {
    {"Open A1_MR",              {13.0, 0.25}},
    {"Open A1_FW",              {20.0, 1.00}},
    {"Open A2_MR",              {20.0, 1.10}},
    {"Open A2_FW",              {22.0, 2.00}},
    {"Open A3_MR",              {21.0, 1.43}},
    {"Open A3_FW",              {25.0, 3.50}},
    {"PDRA_STS_MR",             {23.0, 4.69}},
    {"PDRA_STS_FW",             {28.0, 6.00}},
    {"Specific SAIL I-II_MR",   {19.0, 25.00}},
    {"Specific SAIL I-II_FW",   {30.0, 40.00}},
    {"Specific SAIL III-IV_MR", {19.0, 25.00}},
    {"Specific SAIL III-IV_FW", {30.0, 40.00}}
};

// Estructura para parsear la info del nombre del archivo
struct TrajectoryInfo {
    std::string category;       // "Open A1", "Specific SAIL I-II", "PDRA_STS", etc.
    std::string aircraftType;   // "MR" (Multirotor) o "FW" (Fixed Wing)
    int flightId;               // 14, 1, 2, 3, etc.
    std::string csvFile;        // Nombre completo del archivo (usado como nombre del plan)
};

// Parsea el nombre del archivo para extraer la información
TrajectoryInfo parseTrajectoryFilename(const std::string& filename) {
    TrajectoryInfo info;
    info.csvFile = filename;
    info.flightId = 0;
    
    size_t underscorePos = filename.find('_');
    if (underscorePos != std::string::npos) {
        std::string prefix = filename.substr(0, underscorePos);
        
        size_t lastSpace = prefix.rfind(' ');
        if (lastSpace != std::string::npos) {
            info.category = prefix.substr(0, lastSpace);
            info.aircraftType = prefix.substr(lastSpace + 1);
        } else {
            info.category = prefix;
            info.aircraftType = "";
        }
    }
    
    // Caso especial para PDRA_STS
    if (filename.find("PDRA_STS") != std::string::npos) {
        info.category = "PDRA_STS";
        size_t pdraEnd = filename.find("PDRA_STS ") + 9;
        size_t nextUnderscore = filename.find('_', pdraEnd);
        if (nextUnderscore != std::string::npos) {
            info.aircraftType = filename.substr(pdraEnd, nextUnderscore - pdraEnd);
        }
    }
    
    // Extraer ID
    size_t pos = 0;
    while ((pos = filename.find('_', pos)) != std::string::npos) {
        size_t start = pos + 1;
        size_t end = filename.find('_', start);
        if (end != std::string::npos) {
            std::string potential_id = filename.substr(start, end - start);
            bool is_number = !potential_id.empty() && 
                std::all_of(potential_id.begin(), potential_id.end(), ::isdigit);
            if (is_number) {
                info.flightId = std::stoi(potential_id);
                break;
            }
        }
        pos = start;
    }
    
    return info;
}

// Convierte categoría del nombre del archivo al formato del schema
std::string getCategorySchema(const std::string& category) {
    if (category == "Open A1") return "OPENA1";
    if (category == "Open A2") return "OPENA2";
    if (category == "Open A3") return "OPENA3";
    if (category == "Specific SAIL I-II") return "SAIL_I-II";
    if (category == "Specific SAIL III-IV") return "SAIL_III-IV";
    if (category == "Specific SAIL V-VI") return "SAIL_V-VI";
    if (category == "PDRA_STS") return "SAIL_I-II";
    return "OPENA1";
}

// Convierte "MR" -> "MULTIROTOR", "FW" -> "FIXED_WING"
std::string getAircraftTypeSchema(const std::string& code) {
    if (code == "MR") return "MULTIROTOR";
    if (code == "FW") return "FIXED_WING";
    return "NONE_NOT_DECLARED";
}

// Obtiene los datos UAS para una categoría y tipo
UASData getUASData(const std::string& category, const std::string& aircraftType) {
    std::string key = category + "_" + aircraftType;
    auto it = uasDataMap.find(key);
    if (it != uasDataMap.end()) {
        return it->second;
    }
    return {0.0, 0.0};  // Default si no se encuentra
}

int main() {
    std::cout << "=== Generating Uplans and Operational Intents ===" << std::endl;

    // Configuración de rutas
    std::string setup_path = "setup/scenarios/Benidorm/BelowVLL/traj/";
    std::string output_path = "output/examples/";

    // Crear carpeta de salida si no existe
    fs::create_directories(output_path);

    // Lista de archivos CSV a procesar
    std::vector<std::string> trajectoryFiles = {
        "Open A2 MR_0021_Scan.csv",
        "Specific SAIL I-II FW_0310_Fijo.csv",
        "Specific SAIL III-IV FW_0160_Delivery.csv",
        "PDRA_STS FW_0231_Fijo.csv"
    };

    // Timestamp de inicio: 1 de Septiembre de 2025 a las 09:00:00 UTC
    double start_timestamp = Functions::iso_string_to_timestamp("2025-09-01T09:00:00");
    std::cout << "[INFO] Start time: " << Functions::timestamp_to_iso_string(start_timestamp) << std::endl;

    // Configuración del generador
    UPlanGeneration::UplanConfigComplete config;
    config.TSE_H = 15.0;
    config.TSE_V = 10.0;
    config.Alpha_H = 7.0;
    config.Alpha_V = 1.0;
    config.tbuf = 5.0;
    UPlanGeneration::UplanGeneratorComplete generator(config);

    for (const auto& csvFile : trajectoryFiles) {
        std::string csv_path = setup_path + csvFile;

        // Verificar que el archivo existe
        if (!fs::exists(csv_path)) {
            std::cout << "[WARNING] Trajectory file not found, skipping: " << csv_path << std::endl;
            continue;
        }

        // Parsear información del nombre del archivo
        TrajectoryInfo trajInfo = parseTrajectoryFilename(csvFile);
        
        // Obtener datos UAS (Vmax y MTOM)
        UASData uasData = getUASData(trajInfo.category, trajInfo.aircraftType);
        
        std::cout << "\n[INFO] Processing: " << trajInfo.csvFile << std::endl;
        std::cout << "       ID: " << trajInfo.flightId << std::endl;
        std::cout << "       Category: " << trajInfo.category << " -> " << getCategorySchema(trajInfo.category) << std::endl;
        std::cout << "       Aircraft: " << trajInfo.aircraftType << " -> " << getAircraftTypeSchema(trajInfo.aircraftType) << std::endl;
        std::cout << "       Vmax: " << uasData.vMax << " m/s, MTOM: " << uasData.mtom << " kg" << std::endl;

        // 1. Generar Uplan completo (JSON)
        json uplanJson = generator.generateCompleteUplan(
            trajInfo.flightId,
            trajInfo.csvFile,
            csv_path,
            start_timestamp,
            getCategorySchema(trajInfo.category),
            getAircraftTypeSchema(trajInfo.aircraftType),
            uasData.mtom,
            uasData.vMax
        );

        if (uplanJson.empty()) {
            std::cerr << "[ERROR] Failed to generate Uplan for: " << csvFile << std::endl;
            continue;
        }

        // Guardar Uplan JSON
        std::string uplan_output_file = output_path + "Uplan_" + std::to_string(trajInfo.flightId) + ".json";
        std::ofstream uplan_file(uplan_output_file);
        uplan_file << uplanJson.dump(4);
        uplan_file.close();
        std::cout << "[INFO] Saved Uplan: " << uplan_output_file << std::endl;

        // 2. Crear objeto Uplan a partir del JSON
        try {
            Uplan uplan(uplanJson);
            std::cout << "[INFO] Created Uplan object: " << uplan.getNameplan() << std::endl;

            // 3. Crear OperationalIntent a partir del Uplan
            OPERATOR_FAS::OperationalIntent oi(uplan);
            std::cout << "[INFO] Created OperationalIntent: " << oi.getNameoi() << std::endl;

            // 4. Guardar OperationalIntent JSON
            json oiJson = oi.toJson();
            std::string oi_output_file = output_path + "OI_" + std::to_string(trajInfo.flightId) + ".json";
            std::ofstream oi_file(oi_output_file);
            oi_file << oiJson.dump(4);
            oi_file.close();
            std::cout << "[INFO] Saved OperationalIntent: " << oi_output_file << std::endl;

        } catch (const std::exception& e) {
            std::cerr << "[ERROR] Error creating Uplan/OI for " << csvFile << ": " << e.what() << std::endl;
        }

        start_timestamp += 3600.0;
    }

    std::cout << "\n=== Generation completed ===" << std::endl;
    std::cout << "Check output folder: " << output_path << std::endl;

    return 0;
}