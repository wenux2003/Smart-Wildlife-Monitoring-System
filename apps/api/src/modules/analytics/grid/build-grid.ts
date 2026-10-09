import type postgres from "postgres";
/** UTM grid clipped to the boundary; largest polygon retained, area matches retained geometry. */
export async function buildGrid(
  tx: postgres.TransactionSql,
  parkId: string,
  size: number,
): Promise<number> {
  if (!Number.isInteger(size) || size < 250 || size > 5000)
    throw new Error("Invalid grid cell size.");
  const [boundary] =
    await tx`SELECT boundary IS NOT NULL AND ST_IsValid(boundary) AS valid,
    CEIL(ST_Area(ST_Envelope(ST_Transform(boundary,32644))) / ${size * size}) AS estimated FROM parks WHERE id=${parkId}`;
  if (!boundary?.valid) throw new Error("A valid park boundary is required.");
  if (Number(boundary.estimated) > 20000)
    throw new Error("Grid exceeds the 20,000-cell limit.");
  await tx`DELETE FROM analysis_grid_cells WHERE park_id=${parkId} AND cell_size_m=${size}`;
  const rows = await tx`
    WITH b AS (SELECT ST_Transform(boundary,32644) g FROM parks WHERE id=${parkId}),
    squares AS (SELECT sq.i,sq.j,sq.geom FROM b, ST_SquareGrid(${size},b.g) sq WHERE ST_Intersects(sq.geom,b.g)),
    clipped AS (SELECT i,j,ST_CollectionExtract(ST_Intersection(s.geom,b.g),3) g FROM squares s,b),
    largest AS (SELECT i,j,(SELECT d.geom FROM ST_Dump(c.g) d ORDER BY ST_Area(d.geom) DESC LIMIT 1) g FROM clipped c)
    INSERT INTO analysis_grid_cells(park_id,cell_size_m,col,row,sector_id,geom,geom_m,area_m2)
    SELECT ${parkId},${size},i,j,
      (SELECT id FROM analysis_sectors s WHERE s.park_id=${parkId} AND s.kind='SECTOR'
       AND ST_Intersects(s.area,ST_Transform(l.g,4326))
       ORDER BY ST_Area(ST_Intersection(ST_Transform(s.area,32644),l.g)) DESC,s.id LIMIT 1),
      ST_Transform(g,4326),g,ST_Area(g) FROM largest l WHERE ST_Area(g)>=${0.05 * size * size}
    RETURNING col`;
  if (rows.length > 20000)
    throw new Error("Grid exceeds the 20,000-cell limit.");
  return rows.length;
}
