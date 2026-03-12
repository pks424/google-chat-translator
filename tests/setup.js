// Chrome API 모킹
global.chrome = {
  storage: {
    local: {
      _store: {},
      get(keys, callback) {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
          result[k] = this._store[k];
        });
        callback(result);
      },
      set(items, callback) {
        Object.assign(this._store, items);
        if (callback) callback();
      },
      clear() { this._store = {}; }
    }
  }
};

// fetch 모킹 (Google Translate API)
global.fetch = jest.fn();

// document.execCommand 모킹
document.execCommand = jest.fn();
