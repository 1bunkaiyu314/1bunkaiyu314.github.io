export const storage = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  get(key) {
    const item = localStorage.getItem(key);

    if (item === null) {
      return null;
    }

    try {
      return JSON.parse(item);
    } catch (error) {
      console.warn(`storage.get(): parse failed for key="${key}"`, error);
      return null;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  }
};