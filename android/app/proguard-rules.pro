# ProGuard rules for React Native Android

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-dontwarn com.facebook.react.turbomodule.**

# react-native-gesture-handler
-keep class com.swmansion.gesturehandler.** { *; }

# react-native-screens
-keep class com.swmansion.rnscreens.** { *; }

# react-native-razorpay
-keep class com.razorpay.** {*;}
-dontwarn com.razorpay.**

# React Native standard rules
-keep class com.facebook.react.bridge.CatalystInstanceImpl { *; }
-keep class com.facebook.react.bridge.WritableNativeMap { *; }
-keep class com.facebook.react.bridge.ReadableNativeMap { *; }
-keep class com.facebook.react.bridge.WritableNativeArray { *; }
-keep class com.facebook.react.bridge.ReadableNativeArray { *; }
-keep class com.facebook.react.serialization.IdHybrid { *; }

-keepclassmembers class * {
  @com.facebook.react.bridge.ReactMethod *;
}

-keep class com.facebook.yoga.** { *; }
-keep class com.facebook.react.common.LongLivedObject { *; }
-keep class com.facebook.react.indices.** { *; }

# OkHttp
-keepattributes Signature, InnerClasses, AnnotationDefault
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class sun.misc.Unsafe { *; }
-keep class com.google.gson.stream.** { *; }
-keep class com.google.gson.examples.android.model.** { *; }
