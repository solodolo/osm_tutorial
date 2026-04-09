CREATE TABLE IF NOT EXISTS enwiki_page_geo (
    page_id BIGSERIAL PRIMARY KEY,
    page_namespace bigint not null default 0,
    page_title BYTEA NOT NULL DEFAULT '',
    page_len int not null,
    gt_id BIGINT NOT NULL,
    gt_lat DECIMAL(11,8) DEFAULT NULL,
    gt_lon DECIMAL(11,8) DEFAULT NULL,
    gt_geo GEOMETRY(Point,4326),
    gt_dim NUMERIC(11) DEFAULT NULL,
    gt_type BYTEA NULL DEFAULT '',
    gt_name BYTEA NULL DEFAULT '',
    gt_country BYTEA NULL DEFAULT '',
    gt_region BYTEA NULL DEFAULT '',
    gt_lat_int NUMERIC(6) DEFAULT NULL,
    gt_lon_int NUMERIC(6) DEFAULT NULL,
    page_len_ntile INT not null
);

CREATE UNIQUE INDEX IF NOT EXISTS page_id_gt_id_enwiki_page_geo_idx ON enwiki_page_geo (page_id, gt_id);
CREATE INDEX IF NOT EXISTS gt_geo_enwiki_page_geo_idx ON enwiki_page_geo USING GIST (gt_geo);
CREATE INDEX IF NOT EXISTS pentile_enwiki_page_geo_idx ON enwiki_page_geo (page_len_ntile);
CREATE INDEX IF NOT EXISTS page_len_enwiki_page_geo_idx on enwiki_page_geo (page_len);
