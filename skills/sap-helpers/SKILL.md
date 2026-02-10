# SAP Helpers Skill

SAP development utilities and common commands.

## CAP Development

```bash
# Build CAP project
cds build

# Run locally
cds watch

# Deploy to Cloud Foundry
cf push
```

## Cloud Foundry Operations

```bash
# Login to SAP BTP
cf login -a https://api.cf.sap.hana.ondemand.com

# Check apps
cf apps

# View logs
cf logs <app-name> --recent
```

## HANA Database

```bash
# Connect to HANA
hdbsql -i 00 -n <hostname>:30015 -u <user> -p <password>

# List tables
SELECT * FROM TABLES WHERE SCHEMA_NAME = '<schema>';
```

## Best Practices

1. Always use `cds build` before deployment
2. Check cf target before pushing
3. Use blue-green deployment for production
4. Keep XSUAA bindings up to date

## Common Issues

### CDS Build Fails
- Check Node.js version (18+ required)
- Clear node_modules and rebuild

### CF Push Times Out
- Check app memory limits
- Verify service bindings
- Check network connectivity

### HANA Connection Refused
- Verify tunnel is active
- Check HANA instance status
- Validate credentials
