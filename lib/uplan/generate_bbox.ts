import { vincentyDistAzimuth, vincentyReckon } from "./vincenty";

export interface Waypoint {
  time: number;
  lat: number;
  lon: number;
  h: number;
}

export interface BBox {
  N: number[];
  alt: Record<string, [number, number]>;
  bbox: Record<string, [number, number][]>;
  time: Record<string, [number, number]>;
}

export function generate_bbox(
  init_time: number,
  wp: Waypoint[],
  TSE_H: number,
  TSE_V: number,
  Alpha: number,
  tbuf: number
): BBox {
  const bbox: BBox = {
    N: [],
    alt: {},
    bbox: {},
    time: {},
  };

  for (let i = 0; i < wp.length - 1; i++) {
    const { distance: dist, azimuth: a12 } = vincentyDistAzimuth(
      wp[i].lat,
      wp[i].lon,
      wp[i + 1].lat,
      wp[i + 1].lon
    );
    const distVal = !dist || isNaN(dist) || dist < 1 ? 0.01 : dist;
    const azVal = !dist || isNaN(dist) ? 0 : a12;
    const N = Math.ceil(distVal / (Alpha * TSE_H));
    bbox.N[i] = N;
    const dist_aux = distVal / N;
    const dist_aux_vert = (wp[i + 1].h - wp[i].h) / N;
    const tiempo_tramo = (wp[i + 1].time - wp[i].time) / N;
    const wp_aux: [number, number, number, number][] = [];
    const wp_aux_medio: [number, number, number][] = [];
    wp_aux[0] = [wp[i].lat, wp[i].lon, wp[i].h, wp[i].time];
    wp_aux[N] = [wp[i + 1].lat, wp[i + 1].lon, wp[i + 1].h, wp[i + 1].time];
    const firstMedio = vincentyReckon(
      wp[i].lat,
      wp[i].lon,
      dist_aux / 2,
      azVal
    );
    wp_aux_medio[0] = [
      firstMedio.lat,
      firstMedio.lon,
      wp[i].h + dist_aux_vert / 2,
    ];
    for (let k = 1; k < N; k++) {
      const prev = wp_aux[k - 1];
      const next = vincentyReckon(prev[0], prev[1], dist_aux, azVal);
      wp_aux[k] = [
        next.lat,
        next.lon,
        prev[2] + dist_aux_vert,
        prev[3] + tiempo_tramo,
      ];
      const prevMedio = wp_aux_medio[k - 1];
      const nextMedio = vincentyReckon(
        prevMedio[0],
        prevMedio[1],
        dist_aux,
        azVal
      );
      wp_aux_medio[k] = [
        nextMedio.lat,
        nextMedio.lon,
        prevMedio[2] + dist_aux_vert,
      ];
    }
    for (let k = 0; k < N; k++) {
      const medio = wp_aux_medio[k];
      const rect: [number, number][] = [];
      for (let d = 0; d < 4; d++) {
        const angle = azVal + 45 + d * 90;
        const corner = vincentyReckon(
          medio[0],
          medio[1],
          Math.sqrt(2) * TSE_H,
          angle
        );
        rect.push([corner.lat, ((corner.lon + 180) % 360) - 180]);
      }
      // Cierra el polígono
      rect.push(rect[0]);
      bbox.alt[`${i},${k}`] = [medio[2] + TSE_V, medio[2] - TSE_V];
      bbox.bbox[`${i},${k}`] = rect;
      // Tiempo
      const t1 = wp_aux[k][3];
      const t2 = wp_aux[k + 1] ? wp_aux[k + 1][3] : wp_aux[N][3];
      if (t1 > 1000000) {
        bbox.time[`${i},${k}`] = [t1 - tbuf, t2 + tbuf];
      } else {
        bbox.time[`${i},${k}`] = [
          init_time + t1 - tbuf,
          init_time + t2 + tbuf,
        ];
      }
    }
  }
  return bbox;
}
