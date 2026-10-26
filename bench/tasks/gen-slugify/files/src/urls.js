import { slugify } from "./text.js";

export function articlePath(id, title, options = {}) {
  const slug = slugify(title, options);
  return slug === "" ? `/articles/${id}` : `/articles/${id}/${slug}`;
}

export function tagPath(name, options = {}) {
  const slug = slugify(name, options);
  return slug === "" ? "/tags" : `/tags/${slug}`;
}

export function withTrailingSlash(path) {
  return path.endsWith("/") ? path : `${path}/`;
}
