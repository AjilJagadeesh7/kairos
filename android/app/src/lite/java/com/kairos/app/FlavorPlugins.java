package com.kairos.app;

import com.getcapacitor.BridgeActivity;

/** Lite build: no on-device model, so no extra native plugins. */
final class FlavorPlugins {
    private FlavorPlugins() {}

    static void register(BridgeActivity activity) {
        // Nothing to add in Lite.
    }
}
