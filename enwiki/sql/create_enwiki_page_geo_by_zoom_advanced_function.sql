CREATE OR REPLACE FUNCTION enwiki_page_geo_by_zoom_advanced(z int, x int, y int)
RETURNS bytea AS
$$
DECLARE
    result bytea;
BEGIN
    WITH
    params AS (
      SELECT
        x,
        y,
        z,
        10::int  AS z_full,     -- at this zoom, return 100%
        0.0002::float8 AS p_min,  -- at z=0, return 2% (tune)
        2.0::float8  AS gamma   -- curve (tune): >1 slower early, <1 faster early
    ),
    bounds AS (
      SELECT
        p.*,
        ST_TileEnvelope(p.z, p.x, p.y) AS env,
        LEAST(
          1.0,
          p.p_min + (1.0 - p.p_min) * power(p.z::float8 / p.z_full::float8, p.gamma)
        ) AS frac
      FROM params p
    ),
    candidates AS (
      SELECT
        t.page_id AS id,
        t.page_id,
        t.page_len AS importance,
        t.gt_geo,
        b.env,
        b.frac
      FROM enwiki_page_geo t, bounds b
      WHERE ST_Intersects(t.gt_geo, ST_Transform(b.env, 4326))
    ),
    ranked AS (
      SELECT
        *,
        count(*) OVER () AS n_total,
        row_number() OVER (ORDER BY importance DESC, page_id) AS rn
      FROM candidates
    ),
    kept AS (
      SELECT *
      FROM ranked, bounds b
      WHERE rn <= GREATEST(1, CEIL(n_total * LEAST(1, b.frac)))  -- at z=22, frac=1 => keep all
    ),
    mvtgeom AS (
      SELECT
        id,
        page_id,
        importance,
        ST_AsMVTGeom(ST_Transform(gt_geo, 3857), (SELECT env FROM bounds), 4096, 64, true) AS geom
      FROM kept
    )
    SELECT ST_AsMVT(mvtgeom, 'default', 4096, 'geom')
    INTO result
    FROM mvtgeom;
    RETURN result;
END;
$$
LANGUAGE 'plpgsql'
STABLE
PARALLEL SAFE;

