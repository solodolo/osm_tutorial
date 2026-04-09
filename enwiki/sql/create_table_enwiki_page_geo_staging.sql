CREATE TABLE IF NOT EXISTS enwiki_page_geo_staging (
    page_id BIGSERIAL PRIMARY KEY,
    page_namespace bigint not null default 0,
    page_title VARCHAR(1023) NOT NULL DEFAULT '',
    page_len int not null,
    gt_id BIGINT NOT NULL,
    gt_lat DECIMAL(11,8) DEFAULT NULL,
    gt_lon DECIMAL(11,8) DEFAULT NULL,
    gt_dim NUMERIC(11) DEFAULT NULL,
    gt_type VARCHAR(511) NULL DEFAULT '',
    gt_name VARCHAR(1023) NULL DEFAULT '',
    gt_country VARCHAR(8) NULL DEFAULT '',
    gt_region VARCHAR(8) NULL DEFAULT '',
    gt_lat_int NUMERIC(6) DEFAULT NULL,
    gt_lon_int NUMERIC(6) DEFAULT NULL,
    page_len_ntile INT not null
);

CREATE UNIQUE INDEX IF NOT EXISTS page_id_gt_id_page_geo_idx ON enwiki_page_geo_staging (page_id, gt_id);
