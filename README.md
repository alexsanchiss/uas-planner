# UPPS (UAS Planner)

Aplicación web para operadores de drones. Permite definir o subir planes de vuelo (waypoints, patrones SCAN, ficheros de QGroundControl), calcular trayectorias, enviar el U-Plan al FAS (Flight Authorization Service) para su autorización y activar el vuelo cuando llega su hora.

Las trayectorias se calculan en máquinas virtuales que ejecutan [traj-runner](https://github.com/0xMastxr/traj-runner). Un proceso aparte (`traj-assigner.js`) reparte los planes en cola entre las VM libres.

## Stack

Next.js 15.5 (App Router), React 18, TypeScript, Tailwind CSS 3 con tokens semánticos, Base UI, Prisma 5 con MySQL, zod 4, JWT, Jest. Mapas con Leaflet (2D) y CesiumJS (3D). Interfaz en inglés (por defecto) y español. Requiere Node >= 20.9.

## Puesta en marcha

```bash
git clone <url-del-repositorio> && cd uas-planner
npm ci
cp .env.example .env.local     # rellena los valores; ver .env.example
npx prisma generate
npm run dev                    # http://localhost:3003
```

Variables de entorno: `.env.example` las lista todas, con cuáles son obligatorias. Como mínimo hacen falta `DATABASE_URL` (MySQL) y `JWT_SECRET`. Si `DATABASE_URL` apunta a una base remota, no la alcanzarás desde un equipo de desarrollo: usa un MySQL local para trabajar con datos.

`npm ci` copia los assets de Cesium a `public/cesium` (`postinstall`). Si falta esa carpeta, ejecuta `npm run copy-cesium`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm start` | Servidor en el puerto 3003 (`start` requiere `npm run build`) |
| `npm run build` | Build de producción (no ejecuta el linter) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint 9 |
| `npm test` | Jest (pruebas puras, sin jsdom) |
| `npm run copy-cesium` | Regenera `public/cesium` |
| `node traj-assigner` | Reparte planes en cola a las VM (proceso aparte) |

La CI (`.github/workflows/ci.yml`) ejecuta `npm ci`, `prisma validate/generate`, typecheck, lint, jest, build y `npm audit`.

## Producción

Corre como tres instancias Windows en el VDS (puertos 3002, 3003 y 3004) detrás de Caddy. No se usa Docker. Los pasos de despliegue están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y en la última entrada de [CHANGELOG.md](CHANGELOG.md).

## Documentación

- [AGENTS.md](AGENTS.md): reglas para agentes de código y para quien desarrolla (comandos, contratos que no deben cambiar, criterios de hecho, convención de commits).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): capas, flujo de procesamiento, autenticación, polling, i18n y temas.
- [docs/API.md](docs/API.md): endpoints y contratos externos.
- [docs/icd](docs/icd): ICD v2.4.0 (SPIRIT).
- [CONTRIBUTING.md](CONTRIBUTING.md): ramas y pull requests.
- [CHANGELOG.md](CHANGELOG.md): cambios por versión.
