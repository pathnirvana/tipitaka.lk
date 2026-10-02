/** row shapes returned by the named queries in server/queries.sql (all columns are non-null) */
export interface NodeRow {
  id: number; key: string; parent_id: number; level: number; pali: string; sinh: string; file: string
  page_idx: number; entry_idx: number; child_count: number; mirror_key: string; book_id: number
  page_offset: number; pali_only: number; page_count: number; collection: string
}
export interface ChildRow { id: number; key: string; parent_id: number; level: number; pali: string; sinh: string; file: string; child_count: number }
export interface PathRow { start?: number; start_key?: string; depth: number; id: number; key: string; level: number; pali: string; sinh: string; file: string }
export interface TitleRow { id: number; key: string; pali: string; sinh: string; grp: number; page_idx: number; entry_idx: number }
export interface EntryRow {
  page_idx: number; entry_idx: number; node_key: string; mirror_key: string
  p_type: number; p_level: number; p_text: string; s_type: number; s_level: number; s_text: string
  no_audio: number; audio_idx: number; page_num: number
}
export interface FootnoteRow { page_idx: number; lang: number; idx: number; text: string }
export interface FtsCandidate { d: number; mi: string; node_id: number; file: string; page_idx: number; entry_idx: number; len: number }
export interface FtsText { id: number; p_type: number; p_level: number; p_text: string; s_text: string; node_key: string; file: string; page_idx: number; entry_idx: number }
export interface DictRow { word: string; dict: string | number; meaning: string }
export interface AudioEntryRow { audio_idx: number; page_idx: number; entry_idx: number }
export interface MetaRow { k: string; v: string }
