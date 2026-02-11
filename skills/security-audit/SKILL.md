# Security Audit

Security scanning, vulnerability assessment, compliance checking, and hardening guidance.

## Triggers

Activate this skill when the user asks you to:
- Audit code or configuration for security issues
- Check dependencies for known vulnerabilities
- Review authentication or authorisation flows
- Verify TLS, encryption, or secrets management
- Assess compliance (GDPR, SOC 2, SAP security)
- Respond to a security incident or alert

## Instructions

### Code Security Audit

Scan code for these vulnerability classes (OWASP Top 10):

1. **Injection** (SQL, NoSQL, OS command, LDAP)
   - Look for string concatenation in queries
   - Verify parameterised queries / prepared statements
   - Check `exec`, `eval`, `Function()` usage
2. **Broken Authentication**
   - Password hashing (bcrypt/argon2, not MD5/SHA1)
   - Session management (secure cookies, expiry, rotation)
   - Multi-factor authentication support
3. **Sensitive Data Exposure**
   - Secrets in code, config files, or logs
   - Missing encryption at rest or in transit
   - Overly verbose error messages
4. **Broken Access Control**
   - Missing authorisation checks on endpoints
   - IDOR (Insecure Direct Object Reference)
   - Privilege escalation paths
5. **Security Misconfiguration**
   - Default credentials
   - Unnecessary open ports
   - Debug mode enabled in production
   - Missing security headers (CSP, HSTS, X-Frame-Options)

### Dependency Scanning

```bash
# Node.js
npm audit --json
npx audit-ci --critical

# Python
pip-audit
safety check

# Container images
trivy image <image-name>

# General
trivy fs --security-checks vuln,secret,config .
```

Report findings in this format:
```
| Package       | Severity | CVE           | Fix Version | Status |
|---------------|----------|---------------|-------------|--------|
| lodash        | HIGH     | CVE-2021-xxxx | 4.17.21     | 🔴 Fix |
```

### SAP-Specific Security

- **XSUAA:** Verify scopes, role collections, and attribute mappings
- **Destinations:** Check auth type (OAuth2, BasicAuth) and token forwarding
- **HDI Containers:** Validate grantor/grantee privileges
- **CAP `@restrict`:** Ensure every sensitive entity/action has proper annotations
- **CF Security Groups:** Verify network isolation

### Secrets Management

1. Scan for hardcoded secrets:
   ```bash
   # Look for common patterns
   grep -rn "password\s*=" --include="*.{js,ts,java,py,yaml,json}" .
   grep -rn "api[_-]key\s*=" --include="*.{js,ts,java,py,yaml,json}" .
   ```
2. Verify secrets are in environment variables or secret managers (not in git)
3. Check `.gitignore` includes `.env`, `*.pem`, `credentials.*`
4. Verify no secrets in Docker build layers

### Compliance Checklist

**GDPR:**
- [ ] Personal data inventory documented
- [ ] Consent mechanisms in place
- [ ] Right to deletion implemented
- [ ] Data processing agreements with AI providers
- [ ] Data export capability

**SOC 2:**
- [ ] Access logging enabled and tamper-proof
- [ ] Authentication enforced on all endpoints
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Encryption at rest for sensitive data
- [ ] Incident response plan documented

**SAP BTP:**
- [ ] XSUAA properly configured
- [ ] Audit log service bound
- [ ] Role-based access control enforced
- [ ] Network security groups configured
- [ ] Trust configuration validated

### Incident Response

When responding to a security alert:
1. **Assess** — Determine scope and severity
2. **Contain** — Isolate affected systems (revoke tokens, block IPs)
3. **Investigate** — Trace the attack vector
4. **Remediate** — Fix the vulnerability
5. **Document** — Write an incident report with timeline
6. **Harden** — Add protections to prevent recurrence

## Examples

```
User: Audit this API for security issues
Agent: I'll scan for injection, auth bypass, data exposure, and access
       control issues, then report findings with severity and fixes.
```

```
User: Check our dependencies for vulnerabilities
Agent: I'll run npm audit and trivy, compile a severity-sorted report,
       and provide upgrade commands for critical fixes.
```
