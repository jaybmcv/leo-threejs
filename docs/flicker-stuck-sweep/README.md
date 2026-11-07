# Aft stairs flicker and visibility (#258)

Before (left) and after (right) at the tester's own views (`lv=2`, 1600×900, UI hidden), before this branch merged main.

- `258-before-after.jpg`, `258b-before-after.jpg`: the aft core's flights move into their own `P6_tower_stairs` copy, which the atrium never hides; each riser stops 8 mm under its tread, so the black riser top no longer fights the blue tread (the walk's logarithmic depth buffer makes `polygonOffset` ineffective, so a real gap is needed).
