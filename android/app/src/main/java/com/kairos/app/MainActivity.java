package com.kairos.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(AiHttpPlugin.class);
        // Full build adds the on-device model plugins; Lite adds nothing.
        FlavorPlugins.register(this);
        super.onCreate(savedInstanceState);
    }
}
