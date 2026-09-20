/**
 * Stub module for @/lib/supabase/server used by test-auth-redirect.
 *
 * Provides a mutable `getCurrentUser` that tests can override per-test
 * via `setAuthUser()` to simulate signed-in / signed-out states.
 */

const state = { currentUser: null };

function getCurrentUser() {
  return Promise.resolve(state.currentUser);
}

function getSupabaseServerClient() {
  return null;
}

function setAuthUser(user) {
  state.currentUser = user;
}

function resetAuthUser() {
  state.currentUser = null;
}

module.exports = {
  getCurrentUser,
  getSupabaseServerClient,
  setAuthUser,
  resetAuthUser,
};
