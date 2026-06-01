import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Gecko nsINavHistoryService::DATABASE_SCHEMA_VERSION (Firefox 141+) */
export const FIREFOX_PLACES_SCHEMA_VERSION = 82

const BOOKMARK_TYPE_FOLDER = 2
const SYNC_STATUS_NEW = 1

const ROOT_GUIDS = {
  root: 'root________',
  menu: 'menu________',
  toolbar: 'toolbar_____',
  tags: 'tags________',
  unfiled: 'unfiled_____',
  mobile: 'mobile______',
} as const

/**
 * Firefox places.sqlite 初始化 DDL，顺序与 Gecko Database::InitSchema 新建库路径一致。
 * 来源: toolkit/components/places/nsPlacesTables.h / nsPlacesIndexes.h
 */
const PLACES_SCHEMA_STATEMENTS = [
  `CREATE TABLE moz_origins (
    id INTEGER PRIMARY KEY,
    prefix TEXT NOT NULL,
    host TEXT NOT NULL,
    frecency INTEGER NOT NULL,
    recalc_frecency INTEGER NOT NULL DEFAULT 0,
    alt_frecency INTEGER,
    recalc_alt_frecency INTEGER NOT NULL DEFAULT 0,
    UNIQUE (prefix, host)
  )`,
  `CREATE TABLE moz_places (
    id INTEGER PRIMARY KEY,
    url LONGVARCHAR,
    title LONGVARCHAR,
    rev_host LONGVARCHAR,
    visit_count INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0 NOT NULL,
    typed INTEGER DEFAULT 0 NOT NULL,
    frecency INTEGER DEFAULT -1 NOT NULL,
    last_visit_date INTEGER,
    guid TEXT,
    foreign_count INTEGER DEFAULT 0 NOT NULL,
    url_hash INTEGER DEFAULT 0 NOT NULL,
    description TEXT,
    preview_image_url TEXT,
    site_name TEXT,
    origin_id INTEGER REFERENCES moz_origins(id),
    recalc_frecency INTEGER NOT NULL DEFAULT 0,
    alt_frecency INTEGER,
    recalc_alt_frecency INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE moz_places_extra (
    place_id INTEGER PRIMARY KEY NOT NULL,
    sync_json TEXT,
    FOREIGN KEY (place_id) REFERENCES moz_places(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX moz_places_url_hashindex ON moz_places (url_hash)',
  'CREATE INDEX moz_places_hostindex ON moz_places (rev_host)',
  'CREATE INDEX moz_places_visitcount ON moz_places (visit_count)',
  'CREATE INDEX moz_places_frecencyindex ON moz_places (frecency)',
  'CREATE INDEX moz_places_lastvisitdateindex ON moz_places (last_visit_date)',
  'CREATE UNIQUE INDEX moz_places_guid_uniqueindex ON moz_places (guid)',
  'CREATE INDEX moz_places_originidindex ON moz_places (origin_id)',
  'CREATE INDEX moz_places_altfrecencyindex ON moz_places (alt_frecency)',
  `CREATE TABLE moz_historyvisits (
    id INTEGER PRIMARY KEY,
    from_visit INTEGER,
    place_id INTEGER,
    visit_date INTEGER,
    visit_type INTEGER,
    session INTEGER,
    source INTEGER DEFAULT 0 NOT NULL,
    triggeringPlaceId INTEGER
  )`,
  `CREATE TABLE moz_historyvisits_extra (
    visit_id INTEGER PRIMARY KEY NOT NULL,
    sync_json TEXT,
    FOREIGN KEY (visit_id) REFERENCES moz_historyvisits(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX moz_historyvisits_placedateindex ON moz_historyvisits (place_id, visit_date)',
  'CREATE INDEX moz_historyvisits_fromindex ON moz_historyvisits (from_visit)',
  'CREATE INDEX moz_historyvisits_dateindex ON moz_historyvisits (visit_date)',
  `CREATE TABLE moz_inputhistory (
    place_id INTEGER NOT NULL,
    input LONGVARCHAR NOT NULL,
    use_count INTEGER,
    PRIMARY KEY (place_id, input)
  )`,
  `CREATE TABLE moz_bookmarks (
    id INTEGER PRIMARY KEY,
    type INTEGER,
    fk INTEGER DEFAULT NULL,
    parent INTEGER,
    position INTEGER,
    title LONGVARCHAR,
    keyword_id INTEGER,
    folder_type TEXT,
    dateAdded INTEGER,
    lastModified INTEGER,
    guid TEXT,
    syncStatus INTEGER NOT NULL DEFAULT 0,
    syncChangeCounter INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE moz_bookmarks_deleted (
    guid TEXT PRIMARY KEY,
    dateRemoved INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX moz_bookmarks_itemindex ON moz_bookmarks (fk, type)',
  'CREATE INDEX moz_bookmarks_parentindex ON moz_bookmarks (parent, position)',
  'CREATE INDEX moz_bookmarks_itemlastmodifiedindex ON moz_bookmarks (fk, lastModified)',
  'CREATE INDEX moz_bookmarks_dateaddedindex ON moz_bookmarks (dateAdded)',
  'CREATE UNIQUE INDEX moz_bookmarks_guid_uniqueindex ON moz_bookmarks (guid)',
  `CREATE TABLE moz_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE,
    place_id INTEGER,
    post_data TEXT
  )`,
  'CREATE UNIQUE INDEX moz_keywords_placepostdata_uniqueindex ON moz_keywords (place_id, post_data)',
  `CREATE TABLE moz_anno_attributes (
    id INTEGER PRIMARY KEY,
    name VARCHAR(32) UNIQUE NOT NULL
  )`,
  `CREATE TABLE moz_annos (
    id INTEGER PRIMARY KEY,
    place_id INTEGER NOT NULL,
    anno_attribute_id INTEGER,
    content LONGVARCHAR,
    flags INTEGER DEFAULT 0,
    expiration INTEGER DEFAULT 0,
    type INTEGER DEFAULT 0,
    dateAdded INTEGER DEFAULT 0,
    lastModified INTEGER DEFAULT 0
  )`,
  'CREATE UNIQUE INDEX moz_annos_placeattributeindex ON moz_annos (place_id, anno_attribute_id)',
  `CREATE TABLE moz_items_annos (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL,
    anno_attribute_id INTEGER,
    content LONGVARCHAR,
    flags INTEGER DEFAULT 0,
    expiration INTEGER DEFAULT 0,
    type INTEGER DEFAULT 0,
    dateAdded INTEGER DEFAULT 0,
    lastModified INTEGER DEFAULT 0
  )`,
  'CREATE UNIQUE INDEX moz_items_annos_itemattributeindex ON moz_items_annos (item_id, anno_attribute_id)',
  `CREATE TABLE moz_meta (
    key TEXT PRIMARY KEY,
    value NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE moz_places_metadata_search_queries (
    id INTEGER PRIMARY KEY,
    terms TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE moz_places_metadata (
    id INTEGER PRIMARY KEY,
    place_id INTEGER NOT NULL,
    referrer_place_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    total_view_time INTEGER NOT NULL DEFAULT 0,
    typing_time INTEGER NOT NULL DEFAULT 0,
    key_presses INTEGER NOT NULL DEFAULT 0,
    scrolling_time INTEGER NOT NULL DEFAULT 0,
    scrolling_distance INTEGER NOT NULL DEFAULT 0,
    document_type INTEGER NOT NULL DEFAULT 0,
    search_query_id INTEGER,
    FOREIGN KEY (place_id) REFERENCES moz_places(id) ON DELETE CASCADE,
    FOREIGN KEY (referrer_place_id) REFERENCES moz_places(id) ON DELETE CASCADE,
    FOREIGN KEY (search_query_id) REFERENCES moz_places_metadata_search_queries(id) ON DELETE CASCADE,
    CHECK(place_id != referrer_place_id)
  )`,
  'CREATE UNIQUE INDEX moz_places_metadata_placecreated_uniqueindex ON moz_places_metadata (place_id, created_at)',
  'CREATE INDEX moz_places_metadata_referrerindex ON moz_places_metadata (referrer_place_id)',
  `CREATE TABLE IF NOT EXISTS moz_previews_tombstones (
    hash TEXT PRIMARY KEY
  ) WITHOUT ROWID`,
  `CREATE TABLE moz_newtab_story_click (
    feature TEXT NOT NULL,
    timestamp_s INTEGER NOT NULL,
    card_format_enum INTEGER NOT NULL,
    position INTEGER NOT NULL,
    section_position INTEGER NOT NULL,
    feature_value REAL NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE moz_newtab_story_impression (
    feature TEXT NOT NULL,
    timestamp_s INTEGER NOT NULL,
    card_format_enum INTEGER NOT NULL,
    position INTEGER NOT NULL,
    section_position INTEGER NOT NULL,
    feature_value REAL NOT NULL DEFAULT 1
  )`,
  'CREATE INDEX moz_newtab_story_click_newtab_click_timestampindex ON moz_newtab_story_click (timestamp_s)',
  'CREATE INDEX moz_newtab_story_impression_newtab_impression_timestampindex ON moz_newtab_story_impression (timestamp_s)',
  `CREATE TABLE moz_newtab_shortcuts_interaction (
    id INTEGER PRIMARY KEY,
    place_id INTEGER NOT NULL REFERENCES moz_places(id) ON DELETE CASCADE,
    event_type INTEGER NOT NULL,
    timestamp_s INTEGER NOT NULL,
    pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)),
    tile_position INTEGER NOT NULL
  )`,
  'CREATE INDEX moz_newtab_shortcuts_interaction_timestampindex ON moz_newtab_shortcuts_interaction (timestamp_s)',
  'CREATE INDEX moz_newtab_shortcuts_interaction_placeidindex ON moz_newtab_shortcuts_interaction (place_id)',
]

function firefoxTimestamp() {
  return Date.now() * 1000
}

function ensureBookmarkRoots(db: DatabaseSync) {
  const existing = db.prepare(
    'SELECT id FROM moz_bookmarks WHERE guid = ?',
  ).get(ROOT_GUIDS.root) as { id?: number } | undefined

  if (existing?.id)
    return

  const timestamp = firefoxTimestamp()
  const insertRoot = db.prepare(
    `INSERT INTO moz_bookmarks (
      type, position, title, dateAdded, lastModified, guid, parent, syncChangeCounter, syncStatus
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      IFNULL((SELECT id FROM moz_bookmarks WHERE parent = 0), 0),
      1, ?
    )`,
  )

  insertRoot.run(BOOKMARK_TYPE_FOLDER, 0, '', timestamp, timestamp, ROOT_GUIDS.root, SYNC_STATUS_NEW)

  let position = 0
  const childRoots: Array<{ guid: string, title: string }> = [
    { guid: ROOT_GUIDS.menu, title: 'menu' },
    { guid: ROOT_GUIDS.toolbar, title: 'toolbar' },
    { guid: ROOT_GUIDS.tags, title: 'tags' },
    { guid: ROOT_GUIDS.unfiled, title: 'unfiled' },
  ]

  for (const root of childRoots) {
    insertRoot.run(BOOKMARK_TYPE_FOLDER, position, root.title, timestamp, timestamp, root.guid, SYNC_STATUS_NEW)
    position += 1
  }

  db.prepare(
    `INSERT OR IGNORE INTO moz_bookmarks (type, title, dateAdded, lastModified, guid, position, parent)
     SELECT ?, ?, ?, ?, ?,
       IFNULL((SELECT MAX(position) + 1 FROM moz_bookmarks p WHERE p.parent = b.id), 0),
       b.id
     FROM moz_bookmarks b WHERE b.parent = 0`,
  ).run(BOOKMARK_TYPE_FOLDER, 'mobile', timestamp, timestamp, ROOT_GUIDS.mobile)
}

function initPlacesSchema(db: DatabaseSync) {
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN IMMEDIATE')

  try {
    for (const statement of PLACES_SCHEMA_STATEMENTS)
      db.exec(statement)

    db.exec(`PRAGMA user_version = ${FIREFOX_PLACES_SCHEMA_VERSION}`)
    ensureBookmarkRoots(db)
    db.exec('COMMIT')
  }
  catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  db.exec('PRAGMA journal_mode = WAL')
}

/** 首次启动时创建与 Firefox 官方一致的 places.sqlite */
export async function createFirefoxPlacesDatabase(placesPath: string) {
  await mkdir(dirname(placesPath), { recursive: true })

  const db = new DatabaseSync(placesPath, { timeout: 10_000 })
  try {
    initPlacesSchema(db)
    console.log('[createFirefoxPlacesDatabase] created places.sqlite with schema version', FIREFOX_PLACES_SCHEMA_VERSION, placesPath)
  }
  finally {
    db.close()
  }
}
