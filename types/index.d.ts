/**
 * Whether the person hid a picture: a member per picture, its `id` the call's
 * tool_use_id or the prompt's message id with the picture's place, so a
 * group's line and the call's own row agree.
 */
export type ImagesIsHidden = boolean

/**
 * Whether `/images off` stopped every picture for the session.
 */
export type ImagesIsOff = boolean

/**
 * How many times a row that may hold a moved picture's bytes was kept, or a
 * turn ended, while one was missing: a row still missing one reads it while
 * drawing, so each count draws it again to look.
 */
export type ImagesDeliveries = number

declare module 'claude-code' {
  interface PluginState {
    images: { isHidden: StateFamily<ImagesIsHidden>; isOff: ImagesIsOff; deliveries: ImagesDeliveries }
  }
}
