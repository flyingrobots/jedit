# SPDX-License-Identifier: Apache-2.0
# © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
FROM node:22.23.1-bookworm AS historical-closure
WORKDIR /historical
COPY edict/replace-range-probes/basis-identity/application ./application
COPY edict/replace-range-probes/basis-identity/application-provenance.json ./application-provenance.json
COPY edict/replace-range-probes/basis-identity/verify-closure.mjs ./verify-closure.mjs
COPY edict/replace-range-probes/basis-identity/verify-closure.spec.mjs ./verify-closure.spec.mjs
RUN node --test verify-closure.spec.mjs \
    && node verify-closure.mjs /historical/application /historical/application-provenance.json /application-checksums.sha256

FROM rust:1.94.0-bookworm
WORKDIR /edict
RUN git init && git remote add origin https://github.com/flyingrobots/edict.git \
    && git fetch --depth=1 origin 3f81f759e921a69b04fe8cf8e62e62f8f3dc7b7e \
    && git archive FETCH_HEAD | tar -x
RUN cargo +1.94.0 build --locked -p edict-cli
WORKDIR /echo
RUN git init && git remote add origin https://github.com/flyingrobots/echo.git \
    && git fetch --depth=1 origin 49e9efb68001dfd78563d18bac9359a87671e431 \
    && git archive FETCH_HEAD schemas/edict-provider/package/v1 | tar -x
COPY --from=historical-closure /historical/application /application-source
COPY --from=historical-closure /historical/application-provenance.json /application-provenance.json
COPY --from=historical-closure /application-checksums.sha256 /application-checksums.sha256
COPY edict/replace-range-probes/basis-identity/ReplaceRange.edict /comparison-sources/ReplaceRange.edict
COPY edict/replace-range-probes/basis-identity/PayloadEquality.edict /comparison-sources/PayloadEquality.edict
COPY edict/replace-range-probes/basis-identity/build.sh /comparison-build.sh
CMD ["sh", "/comparison-build.sh"]
