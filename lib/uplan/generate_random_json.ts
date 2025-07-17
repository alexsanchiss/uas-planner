import { BBox, Waypoint } from "./generate_bbox";

export function generateRandomJSON(bbox: BBox, wp: Waypoint[]): unknown {
  if (!wp || wp.length === 0) {
    throw new Error("Waypoints array is empty or undefined.");
  }
  let ordinal = 0;
  // Cambia el tipo de jsonData de unknown a any para evitar errores de tipo
  const jsonData: any = {};

  // Data Owner Identifier
  jsonData.dataOwnerIdentifier = { sac: "UPV", sic: "VLC" };
  jsonData.dataSourceIdentifier = { sac: "UPV", sic: "VLC" };
  jsonData.contactDetails = {
    firstName: "A",
    lastName: "B",
    phones: ["623232323"],
    emails: ["hola@hola.com"],
  };
  jsonData.flightDetails = {
    mode: "VLOS",
    category: "OPENA1",
    specialOperation: "",
    privateFlight: 0,
  };
  jsonData.takeoffLocation = {
    type: "Point",
    coordinates: [wp[0].lon, wp[0].lat],
    properties: { altitude: wp[0].h },
  };
  jsonData.landingLocation = {
    type: "Point",
    coordinates: [wp[wp.length - 1].lon, wp[wp.length - 1].lat],
    properties: { altitude: wp[wp.length - 1].h },
  };
  jsonData.gcsLocation = {
    type: "Point",
    coordinates: [-0.337337, 39.479984],
  };
  jsonData.uas = {
    registrationNumber: "1",
    serialNumber: "2",
    flightCharacteristics: {
      uasMTOM: "3",
      uasMaxSpeed: "4",
      Connectivity: "5G",
      idTechnology: "ADSB",
      maxFlightTime: "7",
    },
    generalCharacteristics: {
      brand: "8",
      model: "9",
      typeCertificate: "10",
      uasType: "MULTIROTOR",
      uasClass: "C1",
      uasDimension: "LT_8",
    },
  };

  // Operation Volumes
  const operationVolumes: unknown[] = [];
  for (let i = 0; i < bbox.N.length; i++) {
    const numSubtramos = bbox.N[i];
    for (let j = 0; j < numSubtramos; j++) {
      const rect = bbox.bbox[`${i},${j}`];
      const coordinates = rect.map(([lat, lon]) => [lon, lat]);
      const lats = rect.map(([lat]) => lat);
      const lons = rect.map(([, lon]) => lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const [timeBeginPosix, timeEndPosix] = bbox.time[`${i},${j}`];
      const timeBegin = new Date(timeBeginPosix * 1000).toISOString();
      const timeEnd = new Date(timeEndPosix * 1000).toISOString();
      const [maxAltitude, minAltitude] = bbox.alt[`${i},${j}`];
      const operationVolume = {
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
          bbox: [minLon, minLat, maxLon, maxLat],
        },
        timeBegin,
        timeEnd,
        minAltitude: { value: minAltitude, reference: "AGL", uom: "M" },
        maxAltitude: { value: maxAltitude, reference: "AGL", uom: "M" },
        ordinal,
      };
      operationVolumes.push(operationVolume);
      ordinal++;
    }
  }
  jsonData.operationVolumes = operationVolumes;
  jsonData.operatorId = "abc";
  jsonData.state = "SENT";
  const now = new Date().toISOString();
  jsonData.creationTime = now;
  jsonData.updateTime = now;
  return jsonData;
}
