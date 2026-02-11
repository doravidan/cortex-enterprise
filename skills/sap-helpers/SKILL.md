# SAP Helpers

SAP development expertise — CAP, Cloud Foundry, HANA, BTP, and Kyma.

## Triggers

Activate this skill when the user asks you to:
- Build or modify a CAP (Cloud Application Programming Model) project
- Deploy to or manage Cloud Foundry on SAP BTP
- Write SQL, SQLScript, or manage HANA databases
- Configure BTP services (XSUAA, Destination, Connectivity)
- Work with Kyma / Kubernetes on SAP BTP
- Troubleshoot SAP-specific issues

## Instructions

### CAP Development

**Project setup:**
```bash
# Create new CAP project
cds init <project-name>

# Add a feature
cds add hana        # HANA database support
cds add xsuaa       # Authentication
cds add approuter   # Application Router
cds add mta         # Multi-Target Application descriptor

# Install dependencies
npm install

# Run locally with watch
cds watch
```

**CDS modelling best practices:**
- Define entities in `db/` schema files
- Define services in `srv/` as projections on entities
- Use `@cds.persistence.exists` for existing HANA tables
- Annotate access control: `@requires: 'authenticated-user'`
- Use aspects for reusable patterns (`managed`, `cuid`, `temporal`)

**Custom handlers:**
```javascript
// srv/my-service.js
module.exports = class MyService extends cds.ApplicationService {
  async init() {
    const { Entity } = this.entities;

    this.before('CREATE', Entity, async (req) => {
      // Validation logic
    });

    this.on('READ', Entity, async (req) => {
      // Custom read logic
    });

    this.after('READ', Entity, (results) => {
      // Post-processing
    });

    await super.init();
  }
};
```

**Testing:**
```bash
# Run all tests
npm test

# Run with coverage
npx jest --coverage

# Test with HTTP requests
cds watch &
curl http://localhost:4004/odata/v4/my-service/Entity
```

### Cloud Foundry Operations

```bash
# Login to SAP BTP
cf login -a https://api.cf.<region>.hana.ondemand.com --sso

# Check current target
cf target

# Deploy
cf push -f manifest.yaml

# Blue-green deployment
cf bg-deploy <mtar-file> --no-confirm

# View recent logs
cf logs <app-name> --recent

# SSH into app container
cf ssh <app-name>

# Scale
cf scale <app-name> -i 3 -m 1G

# Service management
cf create-service xsuaa application <instance-name> -c xs-security.json
cf bind-service <app-name> <service-instance>
cf restage <app-name>
```

### HANA Database

**Connecting:**
```bash
# Via hdbsql
hdbsql -i <instance> -n <host>:443 -u <user> -p <password> -encrypt

# Via cf ssh tunnel
cf ssh <app> -L 30015:<hana-host>:443
```

**Common queries:**
```sql
-- List tables in schema
SELECT TABLE_NAME FROM TABLES WHERE SCHEMA_NAME = '<schema>';

-- Check table row count
SELECT COUNT(*) FROM "<schema>"."<table>";

-- View HDI container objects
SELECT * FROM _SYS_DI.M_OBJECTS WHERE CONTAINER_NAME = '<container>';

-- Monitor connections
SELECT * FROM M_CONNECTIONS WHERE CONNECTION_STATUS = 'RUNNING';

-- Check memory usage
SELECT HOST, ROUND(USED_MEMORY_SIZE/1024/1024/1024, 2) AS USED_GB
FROM M_HOST_RESOURCE_UTILIZATION;
```

### MTA Build & Deploy

```bash
# Install MTA build tool
npm install -g mbt

# Build MTA archive
mbt build

# Deploy with Cloud MTA Build Tool
cf deploy mta_archives/<project>_<version>.mtar

# Undeploy
cf undeploy <mta-id> --delete-services --delete-service-keys
```

### BTP Service Configuration

**XSUAA (xs-security.json):**
```json
{
  "xsappname": "my-app",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.Admin", "description": "Admin access" },
    { "name": "$XSAPPNAME.Viewer", "description": "Read access" }
  ],
  "role-templates": [
    { "name": "Admin", "scope-references": ["$XSAPPNAME.Admin"] },
    { "name": "Viewer", "scope-references": ["$XSAPPNAME.Viewer"] }
  ]
}
```

### Troubleshooting

**CDS Build Fails:**
1. Check Node.js version (`node -v`, need 18+)
2. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Check for circular dependencies in CDS models
4. Run `cds compile` to see detailed errors

**CF Push Times Out:**
1. Increase memory in `manifest.yaml` or `mta.yaml`
2. Check service bindings are correct
3. Verify buildpack compatibility
4. Check `cf logs <app> --recent` for startup errors

**HANA Connection Refused:**
1. Verify the instance is running: check BTP cockpit
2. Check CF SSH tunnel is active
3. Validate credentials (especially after rotation)
4. Check IP allowlisting / security groups

**XSUAA 401/403:**
1. Check token scopes: decode JWT at jwt.io (non-production only)
2. Verify role collection assignments in BTP cockpit
3. Check xs-security.json matches the deployed configuration
4. Restage after binding changes: `cf restage <app>`

## Examples

```
User: Create a new CAP project with HANA and authentication
Agent: I'll run cds init, add hana and xsuaa features, configure the
       data model and service, set up xs-security.json, and verify
       it builds and runs locally.
```

```
User: Deploy my app to Cloud Foundry
Agent: I'll check cf target, build the MTA archive, deploy with
       blue-green strategy, and verify the health endpoint responds.
```
