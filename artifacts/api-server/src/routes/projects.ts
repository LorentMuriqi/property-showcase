import { Router, type IRouter } from "express";
import { db, projectsTable, projectImagesTable } from "@workspace/db";
import { eq, like, and, desc, or, sql, ilike } from "drizzle-orm";
import {
  ListProjectsQueryParams,
  GetProjectParams,
  CreateProjectBody,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  ListCitiesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getProjectWithImages(id: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) return null;

  const images = await db
    .select()
    .from(projectImagesTable)
    .where(eq(projectImagesTable.projectId, id))
    .orderBy(desc(projectImagesTable.isPrimary));

  return {
    ...project,
    areaM2: project.areaM2 ?? null,
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? null,
      isPrimary: img.isPrimary,
    })),
  };
}

router.get("/projects", async (req, res) => {
  const parsed = ListProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { country, city, search, page, limit, recent } = parsed.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 12);

  const conditions: ReturnType<typeof eq>[] = [];
  if (country) conditions.push(eq(projectsTable.country, country));
  if (city) conditions.push(eq(projectsTable.city, city));
  if (search) {
    conditions.push(
      or(
        ilike(projectsTable.title, `%${search}%`),
        ilike(projectsTable.description, `%${search}%`)
      ) as ReturnType<typeof eq>
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(whereClause),
    db
      .select()
      .from(projectsTable)
      .where(whereClause)
      .orderBy(desc(projectsTable.createdAt))
      .limit(recent ? 10 : (limit ?? 12))
      .offset(recent ? 0 : offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  const pageNum = page ?? 1;
  const limitNum = limit ?? 12;

  const projectIds = rows.map((r) => r.id);
  let allImages: (typeof projectImagesTable.$inferSelect)[] = [];
  if (projectIds.length > 0) {
    allImages = await db
      .select()
      .from(projectImagesTable)
      .where(
        sql`${projectImagesTable.projectId} = ANY(${sql.raw(
          `ARRAY[${projectIds.join(",")}]::int[]`
        )})`
      )
      .orderBy(desc(projectImagesTable.isPrimary));
  }

  const imagesByProject = new Map<number, typeof allImages>();
  for (const img of allImages) {
    if (!imagesByProject.has(img.projectId)) {
      imagesByProject.set(img.projectId, []);
    }
    imagesByProject.get(img.projectId)!.push(img);
  }

  const projects = rows.map((project) => ({
    ...project,
    areaM2: project.areaM2 ?? null,
    images: (imagesByProject.get(project.id) ?? []).map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? null,
      isPrimary: img.isPrimary,
    })),
  }));

  res.json({
    projects,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get("/projects/:id", async (req, res) => {
  const parsed = GetProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const project = await getProjectWithImages(parsed.data.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

router.post("/admin/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error });
    return;
  }

  const { images, ...projectData } = parsed.data;

  const [created] = await db
    .insert(projectsTable)
    .values({
      ...projectData,
      updatedAt: new Date(),
    })
    .returning();

  if (images && images.length > 0) {
    await db.insert(projectImagesTable).values(
      images.map((img) => ({
        projectId: created.id,
        url: img.url,
        caption: img.caption ?? null,
        isPrimary: img.isPrimary,
      }))
    );
  }

  const project = await getProjectWithImages(created.id);
  res.status(201).json(project);
});

router.put("/admin/projects/:id", async (req, res) => {
  const paramParsed = UpdateProjectParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const bodyParsed = UpdateProjectBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validation failed", details: bodyParsed.error });
    return;
  }

  const existing = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, paramParsed.data.id),
  });
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { images, ...projectData } = bodyParsed.data;

  await db
    .update(projectsTable)
    .set({ ...projectData, updatedAt: new Date() })
    .where(eq(projectsTable.id, paramParsed.data.id));

  if (images !== undefined) {
    await db
      .delete(projectImagesTable)
      .where(eq(projectImagesTable.projectId, paramParsed.data.id));

    if (images.length > 0) {
      await db.insert(projectImagesTable).values(
        images.map((img) => ({
          projectId: paramParsed.data.id,
          url: img.url,
          caption: img.caption ?? null,
          isPrimary: img.isPrimary,
        }))
      );
    }
  }

  const project = await getProjectWithImages(paramParsed.data.id);
  res.json(project);
});

router.delete("/admin/projects/:id", async (req, res) => {
  const parsed = DeleteProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const existing = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, parsed.data.id),
  });
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, parsed.data.id));
  res.json({ success: true, message: "Project deleted" });
});

router.get("/locations/countries", async (_req, res) => {
  const result = await db
    .selectDistinct({ country: projectsTable.country })
    .from(projectsTable)
    .orderBy(projectsTable.country);

  res.json(result.map((r) => r.country));
});

router.get("/locations/cities", async (req, res) => {
  const parsed = ListCitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const whereClause = parsed.data.country
    ? eq(projectsTable.country, parsed.data.country)
    : undefined;

  const result = await db
    .selectDistinct({ city: projectsTable.city })
    .from(projectsTable)
    .where(whereClause)
    .orderBy(projectsTable.city);

  res.json(result.map((r) => r.city));
});

export default router;
