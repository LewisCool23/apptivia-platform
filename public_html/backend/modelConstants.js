/**
 * modelConstants.js — Single source of truth for all Claude model IDs.
 * Every backend file that calls the Anthropic API MUST import from here.
 * Zero hardcoded model strings elsewhere in the codebase.
 */

'use strict';

const SONNET_MODEL = 'claude-sonnet-4-6-20250514';
const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';

module.exports = { SONNET_MODEL, HAIKU_MODEL };
