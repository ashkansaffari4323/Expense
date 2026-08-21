require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');

const auth = require('./src/auth');
const cost = require('./src/cost');
const xlsx = require('./src/xlsx');

const app = express();

const upload = multer({
  storage: multer.memoryStorage()
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/*
 * Version
 */
app.get('/api/version', (_, response) => {
  response.json({
    version: 'v61',
    package: '1.0.61',
    supplierDropdown:
      'fast 2LO project/account companies plus contract suppliers',
    templatePerformance:
      'parallel calls with 2.5 second company timeout',
    maximumExcelRows: 1000,
    internalBatchSize: 200,
    recommendedConcurrency: 2
  });
});

/*
 * Autodesk authentication
 */
app.get('/api/auth/login', (_, response) => {
  response.redirect(auth.loginUrl(auth.state()));
});

app.get('/api/auth/callback', async (request, response) => {
  try {
    if (!request.query.code || !auth.valid(request.query.state)) {
      throw new Error('Invalid callback');
    }

    const token = await auth.exchange(request.query.code);

    auth.set(response, {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + token.expires_in * 1000
    });

    response.redirect('/');
  } catch (error) {
    response.status(500).send(error.message);
  }
});

app.get('/api/auth/status', (request, response) => {
  response.json({
    signedIn: Boolean(auth.session(request))
  });
});

app.post('/api/auth/logout', (_, response) => {
  auth.clear(response);
  response.json({ ok: true });
});

/*
 * Hubs and projects
 */
app.get('/api/hubs', auth.ensure, async (request, response) => {
  try {
    const hubs = await cost.hubs(request.aps.access_token);

    response.json(
      hubs.map((hub) => ({
        id: hub.id,
        name: hub.attributes?.name || hub.id
      }))
    );
  } catch (error) {
    response.status(500).json({
      error: error.message
    });
  }
});

app.get(
  '/api/hubs/:hub/projects',
  auth.ensure,
  async (request, response) => {
    try {
      const projects = await cost.projects(
        request.aps.access_token,
        request.params.hub
      );

      response.json(projects);
    } catch (error) {
      response.status(500).json({
        error: error.message
      });
    }
  }
);

/*
 * Autodesk app-only token used for company lookups
 */
let appTokenCache = null;

async function appToken() {
  if (
    appTokenCache &&
    appTokenCache.expiresAt > Date.now() + 60000
  ) {
    return appTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'account:read'
  });

  const response = await fetch(
    'https://developer.api.autodesk.com/authentication/v2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.APS_CLIENT_ID}:${process.env.APS_CLIENT_SECRET}`
          ).toString('base64')
      },
      body
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to obtain company-list token: ${await response.text()}`
    );
  }

  const data = await response.json();

  appTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };

  return appTokenCache.accessToken;
}

/*
 * Company lookup with timeout
 */
async function fetchCompanyPage(token, url, timeoutMs = 2500) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${await response.text()}`
      );
    }

    const data = await response.json();

    return Array.isArray(data)
      ? data
      : data.results || data.data || [];
  } finally {
    clearTimeout(timer);
  }
}

async function projectCompanies(hubId, projectId) {
  let token;

  try {
    token = await Promise.race([
      appToken(),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('company token timeout')),
          2500
        );
      })
    ]);
  } catch {
    return [];
  }

  const accountId = String(hubId || '').replace(/^b\./, '');
  const cleanProjectId = String(projectId || '').replace(
    /^b\./,
    ''
  );

  const region = String(
    process.env.APS_COST_REGION || ''
  ).toLowerCase();

  const baseUrls = [
    `https://developer.api.autodesk.com/hq/v1/accounts/${accountId}/projects/${cleanProjectId}/companies`,
    `https://developer.api.autodesk.com/hq/v1/accounts/${accountId}/companies`
  ];

  if (region && region !== 'aus') {
    baseUrls.unshift(
      `https://developer.api.autodesk.com/hq/v1/regions/${region}/accounts/${accountId}/companies`
    );
  }

  const attempts = baseUrls.map((baseUrl) =>
    fetchCompanyPage(
      token,
      `${baseUrl}?limit=100&offset=0&sort=name`,
      2500
    ).catch(() => [])
  );

  const results = await Promise.all(attempts);

  return results.find((rows) => rows.length) || [];
}

/*
 * Load selected-project context
 */
async function projectContext(request) {
  const selectedProjectIds = String(
    request.query.projectIds ||
      request.body.projectIds ||
      ''
  )
    .split(',')
    .filter(Boolean);

  const allProjects = await cost.projects(
    request.aps.access_token,
    request.params.hub
  );

  const projects = allProjects.filter((project) =>
    selectedProjectIds.includes(project.id)
  );

  const budgets = {};
  const contracts = {};
  const suppliers = {};
  const contractSuppliers = {};

  await Promise.all(
    projects.map(async (project) => {
      const [
        projectBudgets,
        projectContracts,
        companies
      ] = await Promise.all([
        cost.budgets(
          request.aps.access_token,
          project.id
        ),

        cost
          .contracts(
            request.aps.access_token,
            project.id
          )
          .catch(() => []),

        projectCompanies(
          request.params.hub,
          project.id
        )
      ]);

      budgets[project.id] = projectBudgets;
      contracts[project.id] = projectContracts;

      const supplierNames = new Set(
        companies
          .map((company) =>
            String(
              company.name ||
                company.companyName ||
                ''
            ).trim()
          )
          .filter(Boolean)
      );

      contractSuppliers[project.id] = {};

      for (const contract of projectContracts) {
        const supplierName = String(
          contract.supplierName ||
            contract.vendorName ||
            contract.companyName ||
            contract.company?.name ||
            ''
        ).trim();

        const supplierId = String(
          contract.supplierId ||
            contract.companyId ||
            contract.vendorId ||
            contract.company?.id ||
            ''
        ).trim();

        const supplierCompanyUid = String(
          contract.supplierCompanyUid ||
            contract.companyUid ||
            contract.company?.uid ||
            ''
        ).trim();

        if (supplierName) {
          supplierNames.add(supplierName);
        }

        if (
          supplierName ||
          supplierId ||
          supplierCompanyUid
        ) {
          contractSuppliers[project.id][contract.id] = {
            supplierName,
            supplierId,
            supplierCompanyUid
          };
        }
      }

      suppliers[project.id] = [...supplierNames].sort(
        (a, b) => a.localeCompare(b)
      );
    })
  );

  return {
    projects,
    budgets,
    contracts,
    suppliers,
    contractSuppliers,
    supplierCount: Object.values(suppliers).reduce(
      (total, supplierList) =>
        total + supplierList.length,
      0
    )
  };
}

/*
 * Download Excel template
 */
app.get(
  '/api/hubs/:hub/template',
  auth.ensure,
  async (request, response) => {
    try {
      const context = await projectContext(request);
      const buffer = await xlsx.build(context);

      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      response.setHeader(
        'Content-Disposition',
        'attachment; filename=Workday Forma Excel Upload.xlsx'
      );

      response.send(Buffer.from(buffer));
    } catch (error) {
      response.status(500).json({
    