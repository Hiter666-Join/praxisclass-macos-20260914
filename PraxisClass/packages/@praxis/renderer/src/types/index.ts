// The slide object model is the canonical contract from @praxis/dsl. The renderer
// no longer vendors its own copy; it re-exports the DSL types here so the public
// `@praxis/renderer/types` surface stays intact.
export * from '@praxis/dsl';
export * from './effects';
