FROM node:24-alpine AS base

RUN npm install -g pnpm@11.13.1

COPY --chown=node:node . /zeppelin
WORKDIR /zeppelin

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base AS final

ARG COMMIT_HASH
ARG BUILD_TIME

COPY --from=prod-deps /zeppelin/node_modules /zeppelin/node_modules
COPY --from=prod-deps /zeppelin/backend/node_modules /zeppelin/backend/node_modules
#COPY --from=prod-deps /zeppelin/shared/node_modules /zeppelin/shared/node_modules # No prod deps in shared
COPY --from=prod-deps /zeppelin/dashboard/node_modules /zeppelin/dashboard/node_modules

COPY --from=build /zeppelin/backend/dist /zeppelin/backend/dist
COPY --from=build /zeppelin/shared/dist /zeppelin/shared/dist
COPY --from=build /zeppelin/dashboard/dist /zeppelin/dashboard/dist

# Add version info
RUN echo "${COMMIT_HASH}" > /zeppelin/.commit-hash
RUN echo "${BUILD_TIME}" > /zeppelin/.build-time

ENTRYPOINT ["/bin/sh", "/zeppelin/entrypoint.sh"]
