import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.routes.js";
import { orgsRouter } from "./routes/organizations.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { franchiseRouter } from "./routes/franchise.routes.js";
import { companyRouter } from "./routes/company.routes.js";
import { prisma } from "./prisma.js";

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://ayratech-neo-lider-front.isyhhh.easypanel.host",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

const allowedOrigins = Array.from(
  new Set([...env.CORS_ORIGIN.split(","), ...DEFAULT_ALLOWED_ORIGINS].map((s) => s.trim()).filter(Boolean)),
);
const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes("*");
const defaultAllowedHeaders = "Content-Type, Authorization, X-Requested-With, Accept, Origin";

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const requestedHeaders = req.headers["access-control-request-headers"];

  if (origin && (allowAll || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof requestedHeaders === "string" ? requestedHeaders : defaultAllowedHeaders,
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Same-origin / server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (allowAll) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Do NOT throw — throwing prevents CORS headers on the response.
    // Simply omit the header so the browser blocks it with a clear message.
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: defaultAllowedHeaders.split(", "),
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/auth", authRouter);
app.use("/organizations", orgsRouter);
app.use("/admin", adminRouter);
app.use("/franchises", franchiseRouter);
app.use("/companies", companyRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on :${env.PORT}`);
  void bootstrapSuperAdmins();
  void bootstrapDefaultPlans();
  void bootstrapDefaultCompetencies();
});

async function bootstrapSuperAdmins() {
  const emails = env.SUPER_ADMIN_EMAILS;
  if (!emails.length) return;
  try {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    for (const u of users) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: u.id, role: "super_admin" } },
        update: {},
        create: { userId: u.id, role: "super_admin" },
      });
      console.log(`[bootstrap] super_admin garantido para ${u.email}`);
    }
    const missing = emails.filter((e) => !users.find((u) => u.email.toLowerCase() === e));
    for (const e of missing) {
      console.log(`[bootstrap] usuário ${e} ainda não cadastrado — será promovido no próximo boot após registro`);
    }
  } catch (err) {
    console.error("[bootstrap] falha ao promover super_admins", err);
  }
}

async function bootstrapDefaultPlans() {
  const defaults = [
    {
      slug: "essencial",
      name: "Essencial",
      description: "Para começar com líderes individuais.",
      priceMonthly: 9900,
      priceYearly: 99000,
      features: ["Dashboard do Líder", "Avaliação C.O.R.E.", "PDI"],
      limits: { max_leaders: 10, max_companies: 1, max_ai_tokens: 100000 },
    },
    {
      slug: "profissional",
      name: "Profissional",
      description: "Franquias e times médios com IA Coach.",
      priceMonthly: 29900,
      priceYearly: 299000,
      features: ["Tudo do Essencial", "IA Coach", "Dashboard Empresa", "Feedbacks automáticos"],
      limits: { max_leaders: 100, max_companies: 10, max_ai_tokens: 1000000 },
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Consultorias e grandes redes com branding próprio.",
      priceMonthly: 0,
      priceYearly: 0,
      features: ["Tudo do Profissional", "Branding próprio", "Métodos customizados", "SLA dedicado"],
      limits: { max_leaders: null, max_companies: null, max_ai_tokens: null },
    },
  ];
  try {
    for (const p of defaults) {
      await prisma.plan.upsert({
        where: { slug: p.slug },
        update: {},
        create: p,
      });
    }
    console.log(`[bootstrap] planos padrão garantidos (${defaults.length})`);
  } catch (err) {
    console.error("[bootstrap] falha ao criar planos padrão", err);
  }
}

async function bootstrapDefaultCompetencies() {
  const defaults = [
    { code: "lideranca", name: "Liderança", weight: 3, orderIndex: 1 },
    { code: "comunicacao", name: "Comunicação", weight: 2, orderIndex: 2 },
    { code: "visao_estrategica", name: "Visão Estratégica", weight: 3, orderIndex: 3 },
    { code: "gestao_pessoas", name: "Gestão de Pessoas", weight: 3, orderIndex: 4 },
    { code: "tomada_decisao", name: "Tomada de Decisão", weight: 2, orderIndex: 5 },
    { code: "inteligencia_emocional", name: "Inteligência Emocional", weight: 2, orderIndex: 6 },
  ];
  try {
    for (const c of defaults) {
      await prisma.methodologyCompetency.upsert({
        where: { code: c.code },
        update: {},
        create: c,
      });
    }
    console.log(`[bootstrap] competências C.O.R.E. garantidas (${defaults.length})`);
  } catch (err) {
    console.error("[bootstrap] falha ao criar competências", err);
  }
}