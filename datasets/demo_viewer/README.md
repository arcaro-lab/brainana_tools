# Demo dataset — `sub-example`

A small, bundled `brainana` output tree so you can launch the Viewer against real data
without preprocessing your own subject. It is a **trimmed** copy of one macaque subject.


## What's inside

```
sub-example/ses-001/anat/atlas_space-fsnative/
    atlas-*_space-fsnative_*.nii.gz              atlas label + retinotopy/somatotopy volumes
    atlas-*_space-fsnative_hemi-{L,R}_*.func.gii  surface overlays
    atlas-*.tsv                                  region LUTs
    *.json  *.bib  *.md                          sidecars (provenance; not read by the Viewer)
fastsurfer/sub-example/
    mri/norm.mgz        required default base volume (fsnative)
    mri/T1.mgz          optional selectable base
    surf/{lh,rh}.*      pial, white, smoothwm, inflated, sphere + curv/sulc/thickness morphometry
```
