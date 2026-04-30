"use strict";

// CJK Unified Ideographs + Ext A + Compatibility, Hiragana/Katakana, Hangul.
// Each matched character is surrounded by spaces so PostgreSQL's tokenizer
// produces one token per character, giving per-character search for CJK
// content while leaving Latin-script text untouched.
const CJK_PATTERN = "([\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff])";

const CREATE_HELPER = `
CREATE OR REPLACE FUNCTION outline_split_cjk(input text) RETURNS text AS $$
  SELECT regexp_replace(coalesce(input, ''), E'${CJK_PATTERN}', E' \\\\1 ', 'g');
$$ LANGUAGE sql IMMUTABLE;
`;

// New trigger writes BOTH columns:
//   "searchVector"    — unchanged, original english tokenization (kept for
//                       forward compatibility / other callers like
//                       documentPermanentDeleter).
//   "searchVectorCJK" — new column, english tokenization applied to text
//                       that has been pre-split per-CJK-character.
const NEW_TRIGGER = `
CREATE OR REPLACE FUNCTION documents_search_trigger() RETURNS trigger AS $$
begin
  new."searchVector" :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new."previousTitles", ' , '), '')), 'C') ||
    setweight(to_tsvector('english', substring(coalesce(new.text, ''), 1, 1000000)), 'D');
  new."searchVectorCJK" :=
    setweight(to_tsvector('english', outline_split_cjk(new.title)), 'A') ||
    setweight(to_tsvector('english', outline_split_cjk(array_to_string(new."previousTitles", ' , '))), 'C') ||
    setweight(to_tsvector('english', outline_split_cjk(substring(coalesce(new.text, ''), 1, 1000000))), 'D');
  return new;
end
$$ LANGUAGE plpgsql;
`;

const OLD_TRIGGER = `
CREATE OR REPLACE FUNCTION documents_search_trigger() RETURNS trigger AS $$
begin
  new."searchVector" :=
    setweight(to_tsvector('english', coalesce(new.title, '')),'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new."previousTitles", ' , '),'')),'C') ||
    setweight(to_tsvector('english', substring(coalesce(new.text, ''), 1, 1000000)), 'D');
  return new;
end
$$ LANGUAGE plpgsql;
`;

// Re-fire the trigger on every row so existing rows get a populated
// searchVectorCJK. The original searchVector value is recomputed too, but
// the result is identical to what the old trigger produced.
const REBUILD = `UPDATE documents SET "title" = "title";`;

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS "searchVectorCJK" tsvector;`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS documents_tsv_cjk_idx ON documents USING gin("searchVectorCJK");`
    );
    await queryInterface.sequelize.query(CREATE_HELPER);
    await queryInterface.sequelize.query(NEW_TRIGGER);
    await queryInterface.sequelize.query(REBUILD);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(OLD_TRIGGER);
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS documents_tsv_cjk_idx;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE documents DROP COLUMN IF EXISTS "searchVectorCJK";`
    );
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS outline_split_cjk(text);`
    );
  },
};
