# Usa una imagen base con Node.js 22 LTS
FROM node:22.11

# Define el directorio de trabajo
WORKDIR /app

# Clona el repositorio de GitHub y navega a la rama principal
RUN git clone git@github.com:0xMastxr/uas-planner.git . && \
    git pull origin master

# Instala las dependencias de la app
RUN npm install

# Construye la aplicación Next.js
RUN npm run build

# Exposición de puertos necesarios
EXPOSE 3000
EXPOSE 5555

# Comando por defecto (se usa en docker-compose para lanzar servicios específicos)
CMD ["npm", "start"]
