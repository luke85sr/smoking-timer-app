package com.luke85sr.smokingtimer

import android.os.Bundle
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {

    /**
     * Restituisce il nome del componente principale registrato da JavaScript.
     * Deve corrispondere a quello registrato in AppRegistry.registerComponent
     */
    override fun getMainComponentName(): String = "SmokingTimer" // ✅ correggi se il nome JS è diverso

    override fun onCreate(savedInstanceState: Bundle?) {
        // ✅ Applica il tema definito nello styles.xml prima della creazione
        setTheme(R.style.AppTheme)
        super.onCreate(null)
    }
}
