import { Router, type IRouter } from "express";
import { db, projectsTable, projectImagesTable, virtualTourScenesTable, virtualTourHotspotsTable } from "@workspace/db";
import { eq, and, desc, or, sql, ilike } from "drizzle-orm";
import {
  ListProjectsQueryParams,
  GetProjectParams,
  CreateProjectBody,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  ListCitiesQueryParams,
  GetVirtualTourParams,
  CreateVirtualTourSceneParams,
  CreateVirtualTourSceneBody,
  UpdateVirtualTourSceneParams,
  UpdateVirtualTourSceneBody,
  DeleteVirtualTourSceneParams,
  CreateHotspotParams,
  CreateHotspotBody,
  UpdateHotspotParams,
  UpdateHotspotBody,
  DeleteHotspotParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getHotspotsForScenes(sceneIds: number[]) {
  if (sceneIds.length === 0) return [];
  return db
    .select()
    .from(virtualTourHotspotsTable)
    .where(
      sql`${virtualTourHotspotsTable.fromSceneId} = ANY(${sql.raw(`ARRAY[${sceneIds.join(",")}]::int[]`)})`
    );
}

async function getProjectWithImages(id: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) return null;

  const [images, sceneCount] = await Promise.all([
    db.select().from(projectImagesTable).where(eq(projectImagesTable.projectId, id)).orderBy(desc(projectImagesTable.isPrimary)),
    db.select({ count: sql<number>`count(*)::int` }).from(virtualTourScenesTable).where(eq(virtualTourScenesTable.projectId, id)),
  ]);

  return {
    ...project,
    areaM2: project.areaM2 ?? null,
    hasCustomVirtualTour: (sceneCount[0]?.count ?? 0) > 0,
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? null,
      isPrimary: img.isPrimary,
    })),
  };
}

// List projects
router.get("/projects", async (req, res) => {
  const parsed = ListProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parametra të pavlefshëm" });
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
    db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(whereClause),
    db.select().from(projectsTable).where(whereClause).orderBy(desc(projectsTable.createdAt))
      .limit(recent ? 10 : (limit ?? 12)).offset(recent ? 0 : offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  const pageNum = page ?? 1;
  const limitNum = limit ?? 12;

  const projectIds = rows.map((r) => r.id);
  let allImages: (typeof projectImagesTable.$inferSelect)[] = [];
  let sceneCounts: { projectId: number; count: number }[] = [];

  if (projectIds.length > 0) {
    const idArray = `ARRAY[${projectIds.join(",")}]::int[]`;
    [allImages, sceneCounts] = await Promise.all([
      db.select().from(projectImagesTable)
        .where(sql`${projectImagesTable.projectId} = ANY(${sql.raw(idArray)})`)
        .orderBy(desc(projectImagesTable.isPrimary)),
      db.select({
        projectId: virtualTourScenesTable.projectId,
        count: sql<number>`count(*)::int`,
      }).from(virtualTourScenesTable)
        .where(sql`${virtualTourScenesTable.projectId} = ANY(${sql.raw(idArray)})`)
        .groupBy(virtualTourScenesTable.projectId),
    ]);
  }

  const imagesByProject = new Map<number, typeof allImages>();
  for (const img of allImages) {
    if (!imagesByProject.has(img.projectId)) imagesByProject.set(img.projectId, []);
    imagesByProject.get(img.projectId)!.push(img);
  }
  const sceneCountMap = new Map(sceneCounts.map((s) => [s.projectId, s.count]));

  const projects = rows.map((project) => ({
    ...project,
    areaM2: project.areaM2 ?? null,
    hasCustomVirtualTour: (sceneCountMap.get(project.id) ?? 0) > 0,
    images: (imagesByProject.get(project.id) ?? []).map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? null,
      isPrimary: img.isPrimary,
    })),
  }));

  res.json({ projects, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

// Get single project
router.get("/projects/:id", async (req, res) => {
  const parsed = GetProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const project = await getProjectWithImages(parsed.data.id);
  if (!project) {
    res.status(404).json({ error: "Projekti nuk u gjet" });
    return;
  }
  res.json(project);
});

// Get virtual tour data
router.get("/projects/:id/virtual-tour", async (req, res) => {
  const parsed = GetVirtualTourParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }

  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, parsed.data.id) });
  if (!project) {
    res.status(404).json({ error: "Projekti nuk u gjet" });
    return;
  }

  const scenes = await db.select().from(virtualTourScenesTable)
    .where(eq(virtualTourScenesTable.projectId, parsed.data.id))
    .orderBy(virtualTourScenesTable.sortOrder);

  const sceneIds = scenes.map((s) => s.id);
  const hotspots = await getHotspotsForScenes(sceneIds);

  const hotspotsByScene = new Map<number, typeof hotspots>();
  for (const h of hotspots) {
    if (!hotspotsByScene.has(h.fromSceneId)) hotspotsByScene.set(h.fromSceneId, []);
    hotspotsByScene.get(h.fromSceneId)!.push(h);
  }

  const scenesWithHotspots = scenes.map((scene) => ({
    ...scene,
    hotspots: (hotspotsByScene.get(scene.id) ?? []).map((h) => ({
      id: h.id,
      fromSceneId: h.fromSceneId,
      toSceneId: h.toSceneId,
      yaw: h.yaw,
      pitch: h.pitch,
      label: h.label ?? null,
    })),
  }));

  const defaultScene = scenes.find((s) => s.isDefault) ?? scenes[0];

  res.json({
    projectId: parsed.data.id,
    scenes: scenesWithHotspots,
    defaultSceneId: defaultScene?.id ?? null,
  });
});

// Create project
router.post("/admin/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validimi dështoi", details: parsed.error });
    return;
  }
  const { images, ...projectData } = parsed.data;
  const [created] = await db.insert(projectsTable).values({ ...projectData, updatedAt: new Date() }).returning();
  if (images && images.length > 0) {
    await db.insert(projectImagesTable).values(images.map((img) => ({
      projectId: created.id,
      url: img.url,
      caption: img.caption ?? null,
      isPrimary: img.isPrimary,
    })));
  }
  const project = await getProjectWithImages(created.id);
  res.status(201).json(project);
});

// Update project
router.put("/admin/projects/:id", async (req, res) => {
  const paramParsed = UpdateProjectParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const bodyParsed = UpdateProjectBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validimi dështoi", details: bodyParsed.error });
    return;
  }
  const existing = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, paramParsed.data.id) });
  if (!existing) {
    res.status(404).json({ error: "Projekti nuk u gjet" });
    return;
  }
  const { images, ...projectData } = bodyParsed.data;
  await db.update(projectsTable).set({ ...projectData, updatedAt: new Date() }).where(eq(projectsTable.id, paramParsed.data.id));
  if (images !== undefined) {
    await db.delete(projectImagesTable).where(eq(projectImagesTable.projectId, paramParsed.data.id));
    if (images.length > 0) {
      await db.insert(projectImagesTable).values(images.map((img) => ({
        projectId: paramParsed.data.id,
        url: img.url,
        caption: img.caption ?? null,
        isPrimary: img.isPrimary,
      })));
    }
  }
  const project = await getProjectWithImages(paramParsed.data.id);
  res.json(project);
});

// Delete project
router.delete("/admin/projects/:id", async (req, res) => {
  const parsed = DeleteProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const existing = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, parsed.data.id) });
  if (!existing) {
    res.status(404).json({ error: "Projekti nuk u gjet" });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, parsed.data.id));
  res.json({ success: true, message: "Projekti u fshi me sukses" });
});

// Virtual Tour - Create scene
router.post("/admin/projects/:id/virtual-tour/scenes", async (req, res) => {
  const paramParsed = CreateVirtualTourSceneParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const bodyParsed = CreateVirtualTourSceneBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validimi dështoi" });
    return;
  }
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, paramParsed.data.id) });
  if (!project) {
    res.status(404).json({ error: "Projekti nuk u gjet" });
    return;
  }

  // If this is the first scene or isDefault is true, update other scenes
  if (bodyParsed.data.isDefault) {
    await db.update(virtualTourScenesTable)
      .set({ isDefault: false })
      .where(eq(virtualTourScenesTable.projectId, paramParsed.data.id));
  }

  const existingScenes = await db.select({ count: sql<number>`count(*)::int` })
    .from(virtualTourScenesTable).where(eq(virtualTourScenesTable.projectId, paramParsed.data.id));
  const isFirstScene = (existingScenes[0]?.count ?? 0) === 0;

  const [created] = await db.insert(virtualTourScenesTable).values({
    projectId: paramParsed.data.id,
    title: bodyParsed.data.title,
    imageUrl: bodyParsed.data.imageUrl,
    thumbnailUrl: bodyParsed.data.thumbnailUrl ?? null,
    isDefault: bodyParsed.data.isDefault ?? isFirstScene,
    sortOrder: bodyParsed.data.sortOrder ?? 0,
    positionX: bodyParsed.data.positionX ?? null,
    positionY: bodyParsed.data.positionY ?? null,
    pitchCorrection: bodyParsed.data.pitchCorrection ?? 0,
    yawCorrection: bodyParsed.data.yawCorrection ?? 0,
  }).returning();

  res.status(201).json({ ...created, hotspots: [] });
});

// Virtual Tour - Update scene
router.put("/admin/virtual-tour/scenes/:id", async (req, res) => {
  const paramParsed = UpdateVirtualTourSceneParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const bodyParsed = UpdateVirtualTourSceneBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validimi dështoi" });
    return;
  }
  const existing = await db.query.virtualTourScenesTable.findFirst({ where: eq(virtualTourScenesTable.id, paramParsed.data.id) });
  if (!existing) {
    res.status(404).json({ error: "Skena nuk u gjet" });
    return;
  }
  if (bodyParsed.data.isDefault) {
    await db.update(virtualTourScenesTable).set({ isDefault: false }).where(eq(virtualTourScenesTable.projectId, existing.projectId));
  }
  const [updated] = await db.update(virtualTourScenesTable)
    .set({ ...bodyParsed.data })
    .where(eq(virtualTourScenesTable.id, paramParsed.data.id))
    .returning();

  const hotspots = await db.select().from(virtualTourHotspotsTable).where(eq(virtualTourHotspotsTable.fromSceneId, paramParsed.data.id));
  res.json({ ...updated, hotspots });
});

// Virtual Tour - Delete scene
router.delete("/admin/virtual-tour/scenes/:id", async (req, res) => {
  const parsed = DeleteVirtualTourSceneParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const existing = await db.query.virtualTourScenesTable.findFirst({ where: eq(virtualTourScenesTable.id, parsed.data.id) });
  if (!existing) {
    res.status(404).json({ error: "Skena nuk u gjet" });
    return;
  }
  await db.delete(virtualTourScenesTable).where(eq(virtualTourScenesTable.id, parsed.data.id));
  res.json({ success: true, message: "Skena u fshi me sukses" });
});

// Hotspot - Create
router.post("/admin/virtual-tour/scenes/:id/hotspots", async (req, res) => {
  const paramParsed = CreateHotspotParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const bodyParsed = CreateHotspotBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validimi dështoi" });
    return;
  }
  const scene = await db.query.virtualTourScenesTable.findFirst({ where: eq(virtualTourScenesTable.id, paramParsed.data.id) });
  if (!scene) {
    res.status(404).json({ error: "Skena nuk u gjet" });
    return;
  }
  const [created] = await db.insert(virtualTourHotspotsTable).values({
    fromSceneId: paramParsed.data.id,
    toSceneId: bodyParsed.data.toSceneId,
    yaw: bodyParsed.data.yaw,
    pitch: bodyParsed.data.pitch,
    label: bodyParsed.data.label ?? null,
  }).returning();
  res.status(201).json({
    id: created.id,
    fromSceneId: created.fromSceneId,
    toSceneId: created.toSceneId,
    yaw: created.yaw,
    pitch: created.pitch,
    label: created.label ?? null,
  });
});

// Hotspot - Update
router.put("/admin/virtual-tour/hotspots/:id", async (req, res) => {
  const paramParsed = UpdateHotspotParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const bodyParsed = UpdateHotspotBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validimi dështoi" });
    return;
  }
  const [updated] = await db.update(virtualTourHotspotsTable)
    .set({ ...bodyParsed.data })
    .where(eq(virtualTourHotspotsTable.id, paramParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Hotspot-i nuk u gjet" });
    return;
  }
  res.json({ id: updated.id, fromSceneId: updated.fromSceneId, toSceneId: updated.toSceneId, yaw: updated.yaw, pitch: updated.pitch, label: updated.label ?? null });
});

// Hotspot - Delete
router.delete("/admin/virtual-tour/hotspots/:id", async (req, res) => {
  const parsed = DeleteHotspotParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID e pavlefshme" });
    return;
  }
  const deleted = await db.delete(virtualTourHotspotsTable).where(eq(virtualTourHotspotsTable.id, parsed.data.id)).returning();
  if (!deleted.length) {
    res.status(404).json({ error: "Hotspot-i nuk u gjet" });
    return;
  }
  res.json({ success: true, message: "Hotspot-i u fshi me sukses" });
});

// Locations
router.get("/locations/countries", async (_req, res) => {
  const result = await db.selectDistinct({ country: projectsTable.country }).from(projectsTable).orderBy(projectsTable.country);
  res.json(result.map((r) => r.country));
});

router.get("/locations/cities", async (req, res) => {
  const parsed = ListCitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query e pavlefshme" });
    return;
  }
  const whereClause = parsed.data.country ? eq(projectsTable.country, parsed.data.country) : undefined;
  const result = await db.selectDistinct({ city: projectsTable.city }).from(projectsTable).where(whereClause).orderBy(projectsTable.city);
  res.json(result.map((r) => r.city));
});

export default router;
