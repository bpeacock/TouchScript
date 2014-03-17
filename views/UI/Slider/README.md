```javascript
Slider('name', {
    panels: {
        'myNewSubview':         require('someSubviewFactory'),
        'myExistingSubview':    require('someSubview'),
        {
            content: require('someSubviewOrSubviewFactory')
        }
    },
    speed: '0.5s'
});
```