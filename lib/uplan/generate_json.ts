import { BBox, Waypoint } from "./generate_bbox";

// Función para formatear fechas como 'YYYY-MM-DDTHH:mm:ss'
function formatDate(date: Date | number | string) {
  let d: Date;
  if (typeof date === "number") d = new Date(date * 1000);
  else if (typeof date === "string") d = new Date(date);
  else d = date;
  // Ajuste para evitar milisegundos y 'Z'
  return d.toISOString().replace(/\..*Z$/, "");
}

export function generateJSON(bbox: BBox, waypoints: Waypoint[], uplan: unknown) {
  if (!waypoints || waypoints.length === 0) {
    throw new Error("Waypoints array is empty or undefined.");
  }
  let ordinal = 0;
  const jsonData: any = {};

  // Data Owner Identifier
  jsonData.dataOwnerIdentifier = (uplan as any).dataOwnerIdentifier || {
    sac: "",
    sic: "",
  };
  jsonData.dataSourceIdentifier = (uplan as any).dataSourceIdentifier || {
    sac: "",
    sic: "",
  };
  jsonData.contactDetails = (uplan as any).contactDetails || {
    firstName: "",
    lastName: "",
    phones: [],
    emails: [],
  };
  // Corrige privateFlight a número y claves en minúsculas en flightCharacteristics
  jsonData.flightDetails = {
    mode: (uplan as any).flightDetails?.mode || "",
    category: (uplan as any).flightDetails?.category || "",
    specialOperation: (uplan as any).flightDetails?.specialOperation || "",
    privateFlight: (uplan as any).flightDetails?.privateFlight ? 1 : 0,
  };
  jsonData.takeoffLocation = {
    type: "Point",
    coordinates: [waypoints[0].lon, waypoints[0].lat],
    properties: { altitude: waypoints[0].h },
  };
  jsonData.landingLocation = {
    type: "Point",
    coordinates: [
      waypoints[waypoints.length - 1].lon,
      waypoints[waypoints.length - 1].lat,
    ],
    properties: { altitude: waypoints[waypoints.length - 1].h },
  };
  jsonData.gcsLocation = (uplan as any).gcsLocation || {
    type: "Point",
    coordinates: [-0.337337, 39.479984],
  };
  jsonData.uas = (uplan as any).uas || {
    registrationNumber: "",
    serialNumber: "",
    flightCharacteristics: {
      uasMTOM: "",
      uasMaxSpeed: "",
      Connectivity: "",
      idTechnology: "",
      maxFlightTime: "",
    },
    generalCharacteristics: {
      brand: "",
      model: "",
      typeCertificate: "",
      uasType: "",
      uasClass: "",
      uasDimension: "",
    },
  };
  // Si el objeto viene con mayúsculas, lo normalizo
  if (jsonData.uas.flightCharacteristics) {
    const fc = jsonData.uas.flightCharacteristics;
    jsonData.uas.flightCharacteristics = {
      uasMTOM: fc.uasMTOM || "",
      uasMaxSpeed: fc.uasMaxSpeed || "",
      Connectivity: fc.connectivity || fc.Connectivity || "",
      idTechnology: fc.idTechnology || fc.idtechnology || fc.IDTechnology || "",
      maxFlightTime: fc.maxFlightTime || "",
    };
  }

  // Operation Volumes
  const operationVolumes: any[] = [];
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
      const timeBegin = formatDate(timeBeginPosix);
      const timeEnd = formatDate(timeEndPosix);
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
  jsonData.operatorId = (uplan as any).operatorId || "";
  jsonData.state = (uplan as any).state || "SENT";
  const now = new Date();
  jsonData.creationTime = formatDate((uplan as any).creationTime || now);
  jsonData.updateTime = formatDate((uplan as any).updateTime || now);
  return jsonData;
}
