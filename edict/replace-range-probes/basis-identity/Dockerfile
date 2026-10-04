# SPDX-License-Identifier: Apache-2.0
# © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
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
COPY edict/replace-range /application-source
COPY edict/replace-range-probes/basis-identity/ReplaceRange.edict /comparison-sources/ReplaceRange.edict
COPY edict/replace-range-probes/basis-identity/PayloadEquality.edict /comparison-sources/PayloadEquality.edict
COPY edict/replace-range-probes/basis-identity/build.sh /comparison-build.sh
CMD ["sh", "/comparison-build.sh"]
