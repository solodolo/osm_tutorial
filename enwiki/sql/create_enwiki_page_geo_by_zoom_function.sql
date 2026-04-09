CREATE OR REPLACE FUNCTION enwiki_page_geo_by_zoom(z int, x int, y int)
RETURNS bytea AS
$$
DECLARE
    result bytea;
BEGIN
    WITH bounds AS (
        SELECT ST_TileEnvelope(z, x, y) AS geom
    ),
    mvtgeom AS (
        SELECT ST_AsMVTGeom(ST_Transform(gt.gt_geo, 3857), bounds.geom) AS geom, gt.page_id
        FROM enwiki_page_geo AS gt, bounds
        WHERE ST_Intersects(gt.gt_geo, ST_Transform(bounds.geom, 4326))
        AND gt.page_len_ntile = 66
    )
    SELECT ST_AsMVT(mvtgeom, 'default')
    INTO result
    FROM mvtgeom;

    RETURN result;
END;
$$
LANGUAGE 'plpgsql'
STABLE
PARALLEL SAFE;
