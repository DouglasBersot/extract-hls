FROM node:22-bullseye

# Instala dependências para Chromium
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  libdrm2 \
  libgbm1 \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Evita erro de permissão no Render
RUN npm config set unsafe-perm true

# Copia package.json e instala dependências Node.js
COPY package*.json ./
RUN npm install

# Copia todos os arquivos do projeto
COPY . .

# Expõe a porta do servidor
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server.js"]
