// src/services/dataService.js
export const uploadCSV = async (file) => {
  const form = new FormData();
  form.append('file', file);

  const res = await api.post('/data/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data;
};