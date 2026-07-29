# Replace the monolithic iframe experience with modular application code

The existing visual language and 3D interactions will be preserved, but the single `experience.html` iframe will be replaced by separate React UI, 3D scene, domain-data, IndexedDB persistence, and export modules. The migration costs more upfront than extending the prototype, but makes persistent CRUD, timeline virtualization, and a 200-memory collection maintainable.
