function generate_random_JSON(bbox, wp, output)
    % Initialize jsonData structure
    jsonData = struct();
    ordinal = 0;

    % Data Owner Identifier
    jsonData.dataOwnerIdentifier = struct();
    jsonData.dataOwnerIdentifier.sac = "UPV";
    jsonData.dataOwnerIdentifier.sic = "VLC";

    % Data Source Identifier
    jsonData.dataSourceIdentifier = struct();
    jsonData.dataSourceIdentifier.sac = "UPV";
    jsonData.dataSourceIdentifier.sic = "VLC";

    % Contact Details
    jsonData.contactDetails = struct();
    jsonData.contactDetails.firstName = "A";
    jsonData.contactDetails.lastName = "B";
    jsonData.contactDetails.phones = {"623232323"};
    jsonData.contactDetails.emails = {"hola@hola.com"};

    % Flight Details
    jsonData.flightDetails = struct();
    jsonData.flightDetails.mode = "VLOS";
    jsonData.flightDetails.category=strcat("OPEN","A1");
        
    jsonData.flightDetails.specialOperation = '';
    jsonData.flightDetails.privateFlight = 0;

    % Takeoff Location
    jsonData.takeoffLocation = struct();
    jsonData.takeoffLocation.type = 'Point';
    jsonData.takeoffLocation.coordinates = [wp.lon(1), wp.lat(1)];
    jsonData.takeoffLocation.properties = struct();
    jsonData.takeoffLocation.properties.altitude = wp.h(1);

    % Landing Locationbuen
    jsonData.landingLocation = struct();
    jsonData.landingLocation.type = 'Point';
    jsonData.landingLocation.coordinates = [wp.lon(end), wp.lat(end)];
    jsonData.landingLocation.properties = struct();
    jsonData.landingLocation.properties.altitude = wp.h(end);

    % GCS Location
    jsonData.gcsLocation = struct();
    jsonData.gcsLocation.type = 'Point';
    jsonData.gcsLocation.coordinates = [-0.337337, 39.479984];

    % UAS Details
    jsonData.uas = struct();
    jsonData.uas.registrationNumber = "1";
    jsonData.uas.serialNumber = "2";
    jsonData.uas.flightCharacteristics = struct();
    jsonData.uas.flightCharacteristics.uasMTOM = "3";
    jsonData.uas.flightCharacteristics.uasMaxSpeed = "4";
    jsonData.uas.flightCharacteristics.Connectivity = "5G";
    jsonData.uas.flightCharacteristics.idTechnology = "ADSB";
    jsonData.uas.flightCharacteristics.maxFlightTime = "7";
    jsonData.uas.generalCharacteristics = struct();
    jsonData.uas.generalCharacteristics.brand = "8";
    jsonData.uas.generalCharacteristics.model = "9";
    jsonData.uas.generalCharacteristics.typeCertificate = "10";
    jsonData.uas.generalCharacteristics.uasType="MULTIROTOR";
    jsonData.uas.generalCharacteristics.uasClass = "C1";
    jsonData.uas.generalCharacteristics.uasDimension = "LT_8";

    % Process each bbox segment
    jsonData.operationVolumes = struct();
    operationVolumes = [];
    for i = 1:length(bbox.N)
        numSubtramos = bbox.N(i);
        for j = 1:numSubtramos
            rect = bbox.bbox{i, j};
            
            for k = 1:size(rect, 1)
                coordinates{k} = [rect(k, 2), rect(k, 1)];
            end

            minLat = min(rect(:, 1));
            maxLat = max(rect(:, 1));
            minLon = min(rect(:, 2));
            maxLon = max(rect(:, 2));
        
            timeBegin = datetime(bbox.time{i, j}(1), 'ConvertFrom', 'posixtime', 'TimeZone', 'UTC','Format','yyyy-MM-dd''T''HH:mm:ss');
            timeEnd = datetime(bbox.time{i, j}(2), 'ConvertFrom', 'posixtime', 'TimeZone', 'UTC','Format','yyyy-MM-dd''T''HH:mm:ss');
            minAltitude = bbox.alt{i, j}(2);
            maxAltitude = bbox.alt{i, j}(1);

            operationVolume = struct();
            operationVolume.geometry = struct();
            operationVolume.geometry.type = 'Polygon';
            operationVolume.geometry.coordinates = {coordinates};
            operationVolume.geometry.bbox = [minLon, minLat, maxLon, maxLat];
            operationVolume.timeBegin = timeBegin;
            operationVolume.timeEnd = timeEnd;
            operationVolume.minAltitude = struct('value', minAltitude, 'reference', 'AGL', 'uom', 'M');
            operationVolume.maxAltitude = struct('value', maxAltitude, 'reference', 'AGL', 'uom', 'M');
            operationVolume.ordinal = ordinal;

            operationVolumes = [operationVolumes, operationVolume];
            ordinal = ordinal + 1;
        end
    end
    jsonData.operationVolumes = operationVolumes;

    % Add metadata
    jsonData.operatorId = "abc";
    jsonData.state = 'SENT';
    jsonData.creationTime = datetime("now",'TimeZone', 'UTC','Format','yyyy-MM-dd''T''HH:mm:ss');
    jsonData.updateTime = jsonData.creationTime;

    % Encode JSON
    jsonText = jsonencode(jsonData);

    % Write JSON to file
    fid = fopen(output, 'w');
    if fid == -1
        error('Cannot create JSON file');
    end
    fwrite(fid, jsonText, 'char');
    fclose(fid);
end
