package com.kairos.app;

import com.getcapacitor.BridgeActivity;

/** Full build: the on-device model's native plugins. */
final class FlavorPlugins {
    private FlavorPlugins() {}

    static void register(BridgeActivity activity) {
        activity.registerPlugin(LocalModelPlugin.class);
        activity.registerPlugin(LocalLlmPlugin.class);
    }
}
