export const FULL_SNAPSHOT_FIXTURE_AUTHORITY_MESSAGE = 'Full-snapshot fixture witness requires explicit --allow-full-snapshot-fixture; installed Jim uses graph-backed rope authority by default.';

export function createFullSnapshotFixtureBackedEchoHostedSessionFactory(modules) {
  return {
    create() {
      return createFullSnapshotFixtureBackedEchoHostedSession(modules);
    },
  };
}

export function createFullSnapshotFixtureBackedEchoHostedSession(modules) {
  return modules.sessionAdapter.createEchoBackedTextBufferSession({
    client: clientModule(modules).createEchoTransportJeditOpticClient(
      createFullSnapshotFixtureBackedInstalledTransport(modules),
    ),
  });
}

export function createFullSnapshotFixtureBackedInstalledTransport(modules) {
  return transportModule(modules).createInstalledJeditContractEchoTransport({
    allowFullSnapshotTextAuthority: true,
    runtime: runtimeModule(modules).createFullSnapshotHotTextRuntimeFixture(),
  });
}

export function fullSnapshotFixtureAuthorityReport() {
  return {
    kind: 'full-snapshot-fixture',
    productionSafe: false,
  };
}

function transportModule(modules) {
  return modules.transport ?? modules.installedTransport;
}

function runtimeModule(modules) {
  return modules.runtime ?? modules.textRuntimeFixture;
}

function clientModule(modules) {
  return modules.client ?? modules.transportClient;
}
