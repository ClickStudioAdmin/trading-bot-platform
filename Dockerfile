FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
# next-env.d.ts is gitignored; tsx only needs a stub for tsconfig include.
RUN printf '%s\n' '/// <reference types="next" />' > next-env.d.ts
COPY lib ./lib
ENV TBP_ENGINE_WORKER=1
ENV ENGINE_LOOP_MS=20000
CMD ["npx", "tsx", "lib/engine/worker.ts"]
