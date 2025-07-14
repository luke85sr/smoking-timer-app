package com.luke85sr.smokingtimer

import android.os.Bundle
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript.
     */
    override fun getMainComponentName(): String = "main"

    override fun onCreate(savedInstanceState: Bundle?) {
        // ✅ Usa il tema definito nello styles.xml
        setTheme(R.style.AppTheme)
        super.onCreate(null)
    }
}

