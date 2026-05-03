!macro customRemoveFiles
  ; Clear packaged resources that changed shape across preview rebuilds so
  ; reinstalls/upgrades don't inherit stale runtime files from an older app dir.
  RMDir /r "$INSTDIR\resources\app\runtime"
  RMDir /r "$INSTDIR\resources\app\project_map"
  RMDir /r "$INSTDIR\resources\runtime"
!macroend
