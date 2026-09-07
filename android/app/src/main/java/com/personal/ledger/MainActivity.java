package com.personal.ledger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupPlugin.class);
        registerPlugin(AiClientPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
